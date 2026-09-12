import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";

const OTC_ORIGIN = "https://otcdesks.cash";
/** API hard-caps page size around 60. */
const PAGE_SIZE = 60;
/**
 * Newest-first window for request-path latency.
 * Full catalog is ~22k mixed-venue rows; Meteora venue rows are sparse and
 * currently all appear within the newest ~1.5k (verified via full scan).
 */
const MAX_PAGES = 50;
const PAGE_CONCURRENCY = 10;

type OtcSnapshot = {
  marketCap?: number | null;
  usdPrice?: number | null;
  change24h?: number | null;
  volume24h?: number | null;
  liquidity?: number | null;
  holders?: number | null;
  spark?: number[] | null;
  at?: number | null;
  candlesAt?: number | null;
};

type OtcCoin = {
  mint?: string;
  name?: string | null;
  symbol?: string | null;
  image?: string | null;
  createdAt?: number | null;
  /** Present only on Meteora DBC launches in the live UI. */
  venue?: string | null;
  pairMint?: string | null;
  pairSymbol?: string | null;
  rewardMint?: string | null;
  rewardSymbol?: string | null;
  paired?: boolean | null;
  meteoraConfig?: string | null;
  snapshot?: OtcSnapshot | null;
};

type OtcCoinsResponse = {
  coins?: OtcCoin[];
  total?: number;
  at?: number;
};

function otcHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: OTC_ORIGIN,
    Referer: `${OTC_ORIGIN}/`,
    "User-Agent": "RWAScreener/1.0 (+otcdesks meteora_dbc feed)",
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

/** Treat placeholder zeros as missing. */
function positiveOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  if (n == null || n === 0) return null;
  return n;
}

function absoluteIcon(image: string | undefined | null): string | null {
  if (!image || typeof image !== "string") return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("/")) return `${OTC_ORIGIN}${image}`;
  return `${OTC_ORIGIN}/${image}`;
}

function ageHoursFrom(createdAt: number | null | undefined): number | null {
  if (createdAt == null || !Number.isFinite(createdAt)) return null;
  const ms = createdAt > 1e12 ? createdAt : createdAt * 1000;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, hours);
}

/** Live UI badge: venue === "meteora" (Meteora DBC curve / locked pool at graduation). */
export function isOtcMeteoraDbc(coin: OtcCoin | null | undefined): boolean {
  if (!coin) return false;
  return String(coin.venue || "").trim().toLowerCase() === "meteora";
}

function mapCoin(c: OtcCoin): TokenRow | null {
  const mint = typeof c.mint === "string" ? c.mint.trim() : "";
  if (!mint) return null;
  const snap = c.snapshot ?? null;
  const mcap = positiveOrNull(snap?.marketCap);
  return {
    id: `otcdesks-${mint}`,
    launchpadId: "otcdesks",
    symbol: String(c.symbol || "").trim() || mint.slice(0, 6),
    name:
      String(c.name || "").trim() ||
      String(c.symbol || "").trim() ||
      mint.slice(0, 8),
    mint,
    icon: absoluteIcon(c.image),
    // List/detail payloads have no graduated SoT field — do not invent.
    status: "bonding",
    priceUsd: positiveOrNull(snap?.usdPrice),
    change24hPct: numOrNull(snap?.change24h),
    mcapUsd: mcap,
    fdvUsd: mcap,
    volume24hUsd: positiveOrNull(snap?.volume24h),
    liquidityUsd: positiveOrNull(snap?.liquidity),
    holders: numOrNull(snap?.holders),
    holdersDelta24h: null,
    ageHours: ageHoursFrom(c.createdAt),
    rangeLowUsd: null,
    rangeHighUsd: null,
    rangePos: null,
    // snapshot.spark mixes mcap and price units — leave null.
    spark24h: null,
    draft: false,
  };
}

async function fetchPage(page: number): Promise<OtcCoinsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
    sort: "newest",
    dir: "desc",
  });
  const res = await fetch(`${OTC_ORIGIN}/api/coins?${params}`, {
    headers: otcHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`OTC Desks /api/coins → HTTP ${res.status}`);
  }
  return (await res.json()) as OtcCoinsResponse;
}

/**
 * Live OTC Desks Solana Meteora DBC launches.
 *
 * Source (UI Network SoT): GET https://otcdesks.cash/api/coins?page=&size=&sort=newest&dir=desc
 * Filter: coin.venue === "meteora" (UI Meteora badge; detail also ships meteoraConfig pubkey).
 * Metrics: snapshot.{marketCap,usdPrice,change24h,volume24h,liquidity,holders} when present.
 * Status: no graduated field in payload → bonding only (never invent).
 * Cap: MAX_PAGES × PAGE_SIZE newest rows for request-path latency.
 */
export async function fetchOtcDesksTokens(opts?: {
  phase?: string;
}): Promise<TokenRow[]> {
  const phase = opts?.phase === "fast" ? "fast" : "full";
  return cachedPadFeed("otcdesks", phase, () => loadOtcDesksTokens());
}

async function loadOtcDesksTokens(): Promise<TokenRow[]> {
  try {
    const first = await fetchPage(1);
    const total = typeof first.total === "number" ? first.total : 0;
    const totalPages = Math.max(
      1,
      Math.min(MAX_PAGES, Math.ceil(total / PAGE_SIZE) || MAX_PAGES),
    );

    const pageBodies: OtcCoinsResponse[] = new Array(totalPages);
    pageBodies[0] = first;

    for (let start = 2; start <= totalPages; start += PAGE_CONCURRENCY) {
      const batch: Promise<void>[] = [];
      for (
        let page = start;
        page < start + PAGE_CONCURRENCY && page <= totalPages;
        page++
      ) {
        const p = page;
        batch.push(
          fetchPage(p).then((body) => {
            pageBodies[p - 1] = body;
          }),
        );
      }
      await Promise.all(batch);
    }

    const rows: TokenRow[] = [];
    const seen = new Set<string>();
    for (const body of pageBodies) {
      const coins = Array.isArray(body?.coins) ? body.coins : [];
      for (const raw of coins) {
        if (!isOtcMeteoraDbc(raw)) continue;
        const row = mapCoin(raw);
        if (!row || !row.mint || seen.has(row.mint)) continue;
        seen.add(row.mint);
        rows.push(row);
      }
    }

    rows.sort((a, b) => {
      const am = a.mcapUsd ?? -1;
      const bm = b.mcapUsd ?? -1;
      if (bm !== am) return bm - am;
      const aa = a.ageHours ?? Number.POSITIVE_INFINITY;
      const ba = b.ageHours ?? Number.POSITIVE_INFINITY;
      return aa - ba;
    });

    return rows;
  } catch (err) {
    console.error("[otcdesks] fetchOtcDesksTokens failed", err);
    return [];
  }
}
