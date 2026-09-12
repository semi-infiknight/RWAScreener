import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";
import quoteMintsFile from "../data/quote-mints.json";

const BAGS_ORIGIN = "https://public-api-v2.bags.fm";
const BAGS_LAUNCHES = `${BAGS_ORIGIN}/api/v1/token-launch/damm-v2/launches`;
const CONCURRENCY = 8;
const PAGE_LIMIT = 100;
const MAX_PAGES_PER_MINT = 50;

type QuoteMintsFile = {
  quote_mints?: Array<{ mint?: string }>;
};

type BagsLaunch = {
  tokenMint?: string;
  quoteMint?: string;
  name?: string;
  symbol?: string;
  image?: string;
  status?: string;
  createdAt?: string | number;
  launchType?: string;
};

type DammV2LaunchesPayload = {
  launches?: BagsLaunch[];
  hasMore?: boolean;
  nextCursor?: string | null;
};

function bagsApiKey(): string {
  const key = process.env.BAGS_API_KEY?.trim();
  if (!key) {
    throw new Error("BAGS_API_KEY is required for the Bags live pad feed");
  }
  return key;
}

function allowlistedMints(): string[] {
  const file = quoteMintsFile as QuoteMintsFile;
  const mints = (file.quote_mints ?? [])
    .map((q) => (typeof q?.mint === "string" ? q.mint.trim() : ""))
    .filter(Boolean);
  return [...new Set(mints)];
}

function ageHoursFrom(createdAt: string | number | undefined): number | null {
  if (createdAt == null) return null;
  const ms =
    typeof createdAt === "number"
      ? createdAt > 1e12
        ? createdAt
        : createdAt * 1000
      : Date.parse(String(createdAt));
  if (!Number.isFinite(ms)) return null;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, hours);
}

function createdAtMs(createdAt: string | number | undefined): number {
  if (createdAt == null) return 0;
  const ms =
    typeof createdAt === "number"
      ? createdAt > 1e12
        ? createdAt
        : createdAt * 1000
      : Date.parse(String(createdAt));
  return Number.isFinite(ms) ? ms : 0;
}

/** Explicit Bags launch status → screener status. */
function mapStatus(status: string | undefined): TokenRow["status"] {
  if (status === "MIGRATED") return "graduated";
  if (status === "PRE_GRAD" || status === "PRE_LAUNCH" || status === "MIGRATING") {
    return "bonding";
  }
  // DAMM_V2_DIRECT rows are live pools; treat unknown as graduated.
  return "graduated";
}

/** Prefer reliable gateways — ipfs.io often fails in-browser. */
function rewriteIpfsIcon(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let cid: string | null = null;
  if (trimmed.startsWith("ipfs://")) {
    cid = trimmed.slice("ipfs://".length).replace(/^ipfs\//, "");
  } else {
    const m = trimmed.match(/\/ipfs\/([^/?#]+)/i);
    if (m) cid = m[1];
  }
  if (!cid) return trimmed;
  // Cloudflare first; client onError can fall back further.
  return `https://cloudflare-ipfs.com/ipfs/${cid}`;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function fetchLaunchesForQuote(
  quoteMint: string,
  apiKey: string,
): Promise<BagsLaunch[]> {
  const out: BagsLaunch[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES_PER_MINT; page++) {
    const url = new URL(BAGS_LAUNCHES);
    url.searchParams.set("quoteMint", quoteMint);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
        "User-Agent": "RWAScreener/1.0 (+bags live pad feed)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let body: {
      success?: boolean;
      error?: string;
      response?: DammV2LaunchesPayload;
    };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      throw new Error(
        `Bags /token-launch/damm-v2/launches → HTTP ${res.status}, non-JSON`,
      );
    }
    if (!res.ok || body?.success === false) {
      throw new Error(
        `Bags /token-launch/damm-v2/launches → HTTP ${res.status}: ${body?.error || "failed"}`,
      );
    }
    const payload = body.response ?? {};
    const launches = Array.isArray(payload.launches) ? payload.launches : [];
    out.push(...launches);
    if (!payload.hasMore || !payload.nextCursor) break;
    cursor = payload.nextCursor;
  }
  return out;
}

/**
 * Live Bags xStock-quoted launches.
 * Source: GET /token-launch/damm-v2/launches?quoteMint=<allowlisted mint>
 * Non-SOL / xStock Bags launches are DAMM_V2_DIRECT (no DBC curve).
 * Launches payload has no mcap/vol/liq fields (verified) — metrics stay null. No invented numbers.
 * Fail-closed if BAGS_API_KEY is missing — never fetch this feed unauthenticated.
 * List results cached via lib/pad-cache (pad+phase, short TTL).
 */
export async function fetchBagsTokens(opts?: {
  phase?: string;
}): Promise<TokenRow[]> {
  // Fail-closed before cache — missing key must not be masked by a stale hit.
  bagsApiKey();
  const phase = opts?.phase === "fast" ? "fast" : "full";
  return cachedPadFeed("bags", phase, () => loadBagsTokens());
}

async function loadBagsTokens(): Promise<TokenRow[]> {
  const apiKey = bagsApiKey();
  const quotes = allowlistedMints();
  const allowed = new Set(quotes);
  if (allowed.size === 0) return [];

  const pages = await mapPool(quotes, CONCURRENCY, (mint) =>
    fetchLaunchesForQuote(mint, apiKey),
  );

  const seen = new Set<string>();
  const launches: BagsLaunch[] = [];
  for (const item of pages.flat()) {
    const tokenMint = item?.tokenMint;
    if (!tokenMint || seen.has(tokenMint)) continue;
    if (item.quoteMint && !allowed.has(item.quoteMint)) continue;
    seen.add(tokenMint);
    launches.push(item);
  }

  launches.sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt));

  return launches.map((l) => {
    const mint = l.tokenMint as string;
    return {
      id: `bags-${mint}`,
      launchpadId: "bags",
      symbol: String(l.symbol || "").trim() || mint.slice(0, 6),
      name: String(l.name || "").trim() || l.symbol || mint.slice(0, 8),
      mint,
      icon: rewriteIpfsIcon(typeof l.image === "string" ? l.image : null),
      status: mapStatus(l.status),
      priceUsd: null,
      change24hPct: null,
      mcapUsd: null,
      fdvUsd: null,
      volume24hUsd: null,
      liquidityUsd: null,
      holders: null,
      holdersDelta24h: null,
      ageHours: ageHoursFrom(l.createdAt),
      rangeLowUsd: null,
      rangeHighUsd: null,
      rangePos: null,
      spark24h: null,
      draft: false,
    };
  });
}
