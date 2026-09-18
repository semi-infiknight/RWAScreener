import { randomUUID } from "node:crypto";
import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";
import { mapTrendsItem, type TrendsItem } from "./trends-map";

const TRENDS_ORIGIN = "https://trends.fun";
const TRENDS_API = "https://api.trends.fun";
const MAX_PAGES = 5;

type TrendsRankingResponse = {
  status?: number;
  data?: {
    items?: TrendsItem[];
    next_cursor?: string | null;
  };
};

function trendsHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: TRENDS_ORIGIN,
    Referer: `${TRENDS_ORIGIN}/`,
    "User-Agent": "RWAScreener/1.0 (+trends meteora_dbc feed)",
    "X-Platform": "web",
    "X-HotfixVersion": "1770825600",
    "X-DeviceId": randomUUID(),
    "X-Lang": "en",
  };
}

async function fetchRanking(cursor?: string | null): Promise<TrendsRankingResponse> {
  const url = new URL(`${TRENDS_API}/v1/token/ranking`);
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url, {
    headers: trendsHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    throw new Error(`Trends /v1/token/ranking → HTTP ${res.status}`);
  }
  return (await res.json()) as TrendsRankingResponse;
}

/**
 * Live Trends.fun Meteora DBC catalog.
 *
 * Source: GET https://api.trends.fun/v1/token/ranking
 * (Origin/Referer trends.fun + X-Platform: web required).
 * Metrics: stats.{market_cap,price,volume_24h_usd,holders} when present.
 * Status: stats.migrate_status === 2 → graduated; else bonding.
 * Pagination: stop when a page adds no new mints (ranking cursor can repeat).
 */
export async function fetchTrendsTokens(opts?: {
  phase?: string;
}): Promise<TokenRow[]> {
  const phase = opts?.phase === "fast" ? "fast" : "full";
  return cachedPadFeed("trends", phase, () => loadTrendsTokens());
}

async function loadTrendsTokens(): Promise<TokenRow[]> {
  try {
    const rows: TokenRow[] = [];
    const seen = new Set<string>();
    let cursor: string | null | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await fetchRanking(cursor);
      const items = Array.isArray(body.data?.items) ? body.data.items : [];
      let added = 0;
      for (const raw of items) {
        const row = mapTrendsItem(raw);
        if (!row || !row.mint || seen.has(row.mint)) continue;
        seen.add(row.mint);
        rows.push(row);
        added += 1;
      }
      const next = body.data?.next_cursor;
      if (!next || added === 0) break;
      cursor = next;
    }

    rows.sort((a, b) => {
      const am = a.mcapUsd ?? -1;
      const bm = b.mcapUsd ?? -1;
      if (bm !== am) return bm - am;
      return (b.volume24hUsd ?? -1) - (a.volume24hUsd ?? -1);
    });
    return rows;
  } catch (err) {
    console.error("[trends] fetchTrendsTokens failed", err);
    return [];
  }
}
