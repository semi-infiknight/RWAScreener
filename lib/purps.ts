import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";
import {
  isPurpsMeteoraDbc,
  mapPurpsCoin,
  type PurpsCoin,
} from "./purps-map";

const PURPS_ORIGIN = "https://purps.lol";
/** API ignores limit > 50. */
const PAGE_SIZE = 50;

type PurpsCoinsResponse = {
  ok?: boolean;
  data?: {
    items?: PurpsCoin[];
    total?: number;
    offset?: number;
    limit?: number;
  };
};

function purpsHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: PURPS_ORIGIN,
    Referer: `${PURPS_ORIGIN}/`,
    "User-Agent": "RWAScreener/1.0 (+purps meteora_dbc feed)",
  };
}

async function fetchPage(offset: number): Promise<PurpsCoinsResponse> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  const res = await fetch(`${PURPS_ORIGIN}/api/public/coins/?${params}`, {
    headers: purpsHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Purps /api/public/coins → HTTP ${res.status}`);
  }
  return (await res.json()) as PurpsCoinsResponse;
}

/**
 * Live Purps Solana Meteora DBC launches.
 *
 * Source: GET https://purps.lol/api/public/coins/?limit=50&offset=
 * Filter: origin launchpad|meteora, chain solana (drop pump/pons/robinhood).
 * Metrics: mcap + holders + createdAt when present (no price/vol/liq in payload).
 * Status: launch.migrated === true → graduated; else bonding.
 */
export async function fetchPurpsTokens(opts?: {
  phase?: string;
}): Promise<TokenRow[]> {
  const phase = opts?.phase === "fast" ? "fast" : "full";
  return cachedPadFeed("purps", phase, () => loadPurpsTokens());
}

async function loadPurpsTokens(): Promise<TokenRow[]> {
  try {
    const first = await fetchPage(0);
    const items0 = Array.isArray(first.data?.items) ? first.data.items : [];
    const total =
      typeof first.data?.total === "number" ? first.data.total : items0.length;
    const bodies: PurpsCoinsResponse[] = [first];
    for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
      bodies.push(await fetchPage(offset));
    }

    const rows: TokenRow[] = [];
    const seen = new Set<string>();
    for (const body of bodies) {
      const coins = Array.isArray(body.data?.items) ? body.data.items : [];
      for (const raw of coins) {
        if (!isPurpsMeteoraDbc(raw)) continue;
        const row = mapPurpsCoin(raw);
        if (!row || !row.mint || seen.has(row.mint)) continue;
        seen.add(row.mint);
        rows.push(row);
      }
    }

    rows.sort((a, b) => {
      const am = a.mcapUsd ?? -1;
      const bm = b.mcapUsd ?? -1;
      if (bm !== am) return bm - am;
      return (a.ageHours ?? Number.POSITIVE_INFINITY) -
        (b.ageHours ?? Number.POSITIVE_INFINITY);
    });
    return rows;
  } catch (err) {
    console.error("[purps] fetchPurpsTokens failed", err);
    return [];
  }
}
