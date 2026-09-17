import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";
import {
  mapStonkCatalogRow,
  type StonkCatalogRow,
} from "./stonkoptions-map";

export {
  decimalOrNull,
  mapStonkCatalogRow,
  mapStonkPhase,
  positiveDecimalOrNull,
} from "./stonkoptions-map";

/** Public catalog the stonkoptions.xyz UI reads (IndexerStreamUrlContext default). */
const INDEXER_ORIGIN = "https://indexer.canary.stonkoptions.xyz";
const PAGE_LIMIT = 50;
const MAX_PAGES = 8;

type CatalogPage = {
  rows?: StonkCatalogRow[];
  nextCursor?: string | null;
};

function catalogHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: "https://stonkoptions.xyz",
    Referer: "https://stonkoptions.xyz/",
    "User-Agent": "RWAScreener/1.0 (+stonkoptions meteora_dbc feed)",
  };
}

async function fetchCatalogPage(cursor?: string | null): Promise<CatalogPage> {
  const params = new URLSearchParams({
    sort: "new",
    limit: String(PAGE_LIMIT),
  });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`${INDEXER_ORIGIN}/v2/catalog?${params}`, {
    headers: catalogHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Stonk Options catalog → HTTP ${res.status}`);
  }
  return (await res.json()) as CatalogPage;
}

/**
 * Live Stonk Options markets on Meteora DBC / DAMM v2.
 *
 * Source: GET https://indexer.canary.stonkoptions.xyz/v2/catalog?sort=new&limit=50&cursor=
 * (same host the stonkoptions.xyz UI defaults to). USD fields are the pad’s
 * own indexer numbers — never convert quote-only /api/markets amounts.
 */
export async function fetchStonkOptionsTokens(opts?: {
  phase?: string;
}): Promise<TokenRow[]> {
  const phase = opts?.phase === "fast" ? "fast" : "full";
  return cachedPadFeed("stardotfun", phase, () => loadStonkOptionsTokens());
}

async function loadStonkOptionsTokens(): Promise<TokenRow[]> {
  try {
    const rows: TokenRow[] = [];
    const seen = new Set<string>();
    let cursor: string | null | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await fetchCatalogPage(cursor);
      const batch = Array.isArray(body.rows) ? body.rows : [];
      for (const raw of batch) {
        const mapped = mapStonkCatalogRow(raw);
        if (!mapped || !mapped.mint || seen.has(mapped.mint)) continue;
        seen.add(mapped.mint);
        rows.push(mapped);
      }
      const next =
        typeof body.nextCursor === "string" && body.nextCursor.trim()
          ? body.nextCursor.trim()
          : null;
      if (!next || batch.length === 0) break;
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
    console.error("[stardotfun] fetchStonkOptionsTokens failed", err);
    return [];
  }
}
