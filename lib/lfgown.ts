import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";

const LFGOWN_ORIGIN = "https://letsfuckingown.fun";
const LAUNCHES_URL = `${LFGOWN_ORIGIN}/api/launches`;
const ICON_CONCURRENCY = 6;
const ICON_TIMEOUT_MS = 5_000;
/** Approx. Solana slot duration — used only to turn activationPoint slots into hours. */
const SLOT_MS = 400;

type LfgownLaunch = {
  baseMint?: string;
  name?: string | null;
  symbol?: string | null;
  uri?: string | null;
  quoteMint?: string | null;
  quoteSymbol?: string | null;
  quoteUsdPrice?: number | null;
  baseReserve?: string | null;
  quoteReserve?: string | null;
  threshold?: number | null;
  isMigrated?: boolean | null;
  pool?: string | null;
  config?: string | null;
  tier?: string | null;
  activationPoint?: number | null;
  creator?: string | null;
};

type LaunchesPayload = {
  updatedAt?: string;
  count?: number;
  launches?: LfgownLaunch[];
};

function lfgownHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: LFGOWN_ORIGIN,
    Referer: `${LFGOWN_ORIGIN}/`,
    "User-Agent": "RWAScreener/1.0 (+lfgown live pad feed)",
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function absoluteUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) return `${LFGOWN_ORIGIN}${trimmed}`;
  return `${LFGOWN_ORIGIN}/${trimmed}`;
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

async function fetchLaunches(): Promise<LfgownLaunch[]> {
  const res = await fetch(LAUNCHES_URL, {
    headers: lfgownHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`LFOwn /api/launches → HTTP ${res.status}`);
  }
  const data = (await res.json()) as LaunchesPayload;
  return Array.isArray(data.launches) ? data.launches : [];
}

async function fetchMetadataImage(uri: string | null | undefined): Promise<string | null> {
  const url = absoluteUrl(uri);
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: lfgownHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(ICON_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const meta = (await res.json()) as { image?: unknown };
    return absoluteUrl(typeof meta.image === "string" ? meta.image : null);
  } catch {
    return null;
  }
}

/** Current Solana slot for activationPoint → ageHours. Null on RPC failure. */
async function fetchCurrentSlot(): Promise<number | null> {
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
        params: [{ commitment: "processed" }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown };
    return numOrNull(body.result);
  } catch {
    return null;
  }
}

function ageHoursFromSlot(
  activationPoint: number | null | undefined,
  currentSlot: number | null,
): number | null {
  const ap = numOrNull(activationPoint);
  if (ap == null || currentSlot == null) return null;
  const delta = currentSlot - ap;
  if (!Number.isFinite(delta) || delta < 0) return null;
  const hours = (delta * SLOT_MS) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, hours);
}

/** Quote amount raised in human units (quoteReserve is 6-decimal). */
function quoteRaisedFromLaunch(l: LfgownLaunch): number | null {
  const reserveRaw = l.quoteReserve;
  if (typeof reserveRaw !== "string" && typeof reserveRaw !== "number") return null;
  const reserve = Number(reserveRaw);
  if (!Number.isFinite(reserve) || reserve < 0) return null;
  const amount = reserve / 1e6;
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

/** Raised USD from pad payload — NOT token mcap. */
function raisedUsdFromLaunch(l: LfgownLaunch): number | null {
  const amount = quoteRaisedFromLaunch(l);
  const price = numOrNull(l.quoteUsdPrice);
  if (amount == null || price == null || price < 0) return null;
  const raised = amount * price;
  if (!Number.isFinite(raised) || raised < 0) return null;
  return raised;
}

/**
 * Bonding progress % matching LFOwn site.
 * threshold is quote human units (same as quoteReserve/1e6); graduated → 100.
 */
function progressPctFromLaunch(l: LfgownLaunch): number | null {
  if (l.isMigrated === true) return 100;
  const threshold = numOrNull(l.threshold);
  if (threshold == null || threshold <= 0) return null;
  const raisedQuote = quoteRaisedFromLaunch(l);
  if (raisedQuote == null) return null;
  const pct = Math.min(100, (raisedQuote / threshold) * 100);
  if (!Number.isFinite(pct) || pct < 0) return null;
  return pct;
}

/** rangePos is 0–1 for RangeBar — reuse as bonding progress position. */
function rangePosFromLaunch(l: LfgownLaunch): number | null {
  const pct = progressPctFromLaunch(l);
  if (pct == null) return null;
  return Math.min(1, Math.max(0, pct / 100));
}

/**
 * Status matches LFOwn site:
 * - bonding / on-curve: still on LFOwn curve vs MetaDAO ownership-coin quote
 * - graduated: isMigrated → Meteora DAMM v2
 */
function statusFromLaunch(l: LfgownLaunch): TokenRow["status"] {
  return l.isMigrated === true ? "graduated" : "bonding";
}

function mapLaunch(
  l: LfgownLaunch,
  icon: string | null,
  currentSlot: number | null,
): TokenRow | null {
  const mint = typeof l.baseMint === "string" ? l.baseMint.trim() : "";
  if (!mint) return null;
  // Real derived raised USD + progress only — never invent token mcap/price/vol.
  const raisedUsd = raisedUsdFromLaunch(l);
  const threshold = numOrNull(l.threshold);
  const quoteUsd = numOrNull(l.quoteUsdPrice);
  const targetUsd =
    threshold != null && threshold > 0 && quoteUsd != null && quoteUsd >= 0
      ? threshold * quoteUsd
      : null;
  return {
    id: `lfgown-${mint}`,
    launchpadId: "lfgown",
    symbol: String(l.symbol || "").trim() || mint.slice(0, 6),
    name: String(l.name || "").trim() || String(l.symbol || "").trim() || mint.slice(0, 8),
    mint,
    icon,
    status: statusFromLaunch(l),
    priceUsd: null,
    change24hPct: null,
    mcapUsd: raisedUsd,
    fdvUsd: raisedUsd,
    volume24hUsd: null,
    // Quote locked in curve (raised USD) — same real fields as mcap proxy.
    liquidityUsd: raisedUsd,
    holders: null,
    holdersDelta24h: null,
    ageHours: ageHoursFromSlot(l.activationPoint, currentSlot),
    // Raised vs threshold target USD (honest curve goal markers; RangeBar uses rangePos).
    rangeLowUsd: raisedUsd,
    rangeHighUsd: targetUsd,
    rangePos: rangePosFromLaunch(l),
    spark24h: null,
    draft: false,
  };
}

export type FetchLfgownOptions = {
  /** When true, fetch uri JSON → image for each launch. Default false (fast). */
  enrichIcons?: boolean;
};

/**
 * Live LFOwn launches from letsfuckingown.fun.
 * Source: GET https://letsfuckingown.fun/api/launches (keep all rows; do not filter isMigrated).
 * Pad DBC verified; bonding rows = on-curve vs MetaDAO ownership-coin quote (no DBC-on-curve field in API).
 * Graduated (isMigrated) = Meteora DAMM v2.
 * mcapUsd/fdvUsd = raised USD proxy (quoteReserve/1e6 * quoteUsdPrice), not token mcap.
 * rangePos = bonding progress 0–1 (isMigrated→1 else min(1, quoteRaised/threshold)).
 * rangeLowUsd/rangeHighUsd = raised USD / (threshold * quoteUsdPrice) markers.
 * Sorted highest raised-USD first. Icons from launch.uri metadata `image`.
 * Age from activationPoint (Solana slot) vs current slot — null if RPC unavailable.
 * No invented price/vol. Extra /api/{stats,tokens,markets,volume,prices} are 404.
 * liquidityUsd = raised USD (quoteReserve/1e6 * quoteUsdPrice) — same real field as mcap proxy.
 */
export async function fetchLfgownTokens(
  opts: FetchLfgownOptions = {},
): Promise<TokenRow[]> {
  const enrichIcons = opts.enrichIcons === true;
  const phase = enrichIcons ? "full" : "fast";
  return cachedPadFeed("lfgown", phase, () => loadLfgownTokens(opts));
}

async function loadLfgownTokens(
  opts: FetchLfgownOptions,
): Promise<TokenRow[]> {
  const enrichIcons = opts.enrichIcons === true;
  try {
    const [launches, currentSlot] = await Promise.all([
      fetchLaunches(),
      fetchCurrentSlot(),
    ]);
    if (launches.length === 0) return [];

    const icons = new Map<string, string | null>();
    if (enrichIcons) {
      const withUri = launches.filter(
        (l) => typeof l.baseMint === "string" && l.baseMint && l.uri,
      );
      const images = await mapPool(withUri, ICON_CONCURRENCY, (l) =>
        fetchMetadataImage(l.uri),
      );
      withUri.forEach((l, i) => {
        if (l.baseMint) icons.set(l.baseMint, images[i] ?? null);
      });
    }

    const rows: TokenRow[] = [];
    const seen = new Set<string>();
    for (const l of launches) {
      const mint = typeof l.baseMint === "string" ? l.baseMint.trim() : "";
      if (!mint || seen.has(mint)) continue;
      seen.add(mint);
      const row = mapLaunch(l, icons.get(mint) ?? null, currentSlot);
      if (row) rows.push(row);
    }

    // Highest raised USD first (mcapUsd/fdvUsd carry that proxy). Nulls last.
    rows.sort((a, b) => {
      const ar = a.mcapUsd ?? Number.NEGATIVE_INFINITY;
      const br = b.mcapUsd ?? Number.NEGATIVE_INFINITY;
      if (ar !== br) return br - ar;
      const ah = a.ageHours ?? Number.POSITIVE_INFINITY;
      const bh = b.ageHours ?? Number.POSITIVE_INFINITY;
      if (ah !== bh) return ah - bh;
      return (a.symbol || "").localeCompare(b.symbol || "");
    });

    return rows;
  } catch (err) {
    console.error("[lfgown] fetchLfgownTokens failed", err);
    return [];
  }
}

/** Single-mint icon (+ age) enrich for LivePadScreener sequential updates. */
export async function enrichLfgownToken(
  mint: string,
): Promise<Partial<TokenRow> | null> {
  const trimmed = mint.trim();
  if (!trimmed) return null;
  try {
    const [launches, currentSlot] = await Promise.all([
      fetchLaunches(),
      fetchCurrentSlot(),
    ]);
    const launch = launches.find(
      (l) => typeof l.baseMint === "string" && l.baseMint.trim() === trimmed,
    );
    if (!launch) return null;
    const icon = await fetchMetadataImage(launch.uri);
    const raisedUsd = raisedUsdFromLaunch(launch);
    const threshold = numOrNull(launch.threshold);
    const quoteUsd = numOrNull(launch.quoteUsdPrice);
    const targetUsd =
      threshold != null && threshold > 0 && quoteUsd != null && quoteUsd >= 0
        ? threshold * quoteUsd
        : null;
    return {
      id: `lfgown-${trimmed}`,
      mint: trimmed,
      icon,
      ageHours: ageHoursFromSlot(launch.activationPoint, currentSlot),
      status: statusFromLaunch(launch),
      mcapUsd: raisedUsd,
      fdvUsd: raisedUsd,
      liquidityUsd: raisedUsd,
      rangeLowUsd: raisedUsd,
      rangeHighUsd: targetUsd,
      rangePos: rangePosFromLaunch(launch),
    };
  } catch {
    return null;
  }
}
