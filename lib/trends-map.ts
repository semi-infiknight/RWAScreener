import type { TokenRow } from "./tokens";

export type TrendsStats = {
  market_cap?: string | number | null;
  volume_24h_usd?: string | number | null;
  price?: string | number | null;
  holders?: number | null;
  migrate_status?: number | null;
};

export type TrendsItem = {
  mint_addr?: string;
  name?: string | null;
  symbol?: string | null;
  image?: string | null;
  created_at?: number | null;
  stats?: TrendsStats | null;
};

/**
 * Observed ranking payload: migrate_status === 2 after DAMM migrate.
 * Other codes / missing → bonding (do not invent).
 */
export function mapTrendsMigrate(
  status: number | null | undefined,
): TokenRow["status"] {
  return status === 2 ? "graduated" : "bonding";
}

export function decimalOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function positiveDecimalOrNull(v: unknown): number | null {
  const n = decimalOrNull(v);
  if (n == null || n === 0) return null;
  return n;
}

function ageHoursFromUnix(createdAt: number | null | undefined): number | null {
  if (createdAt == null || !Number.isFinite(createdAt)) return null;
  const ms = createdAt > 1e12 ? createdAt : createdAt * 1000;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, hours);
}

export function mapTrendsItem(item: TrendsItem): TokenRow | null {
  const mint = typeof item.mint_addr === "string" ? item.mint_addr.trim() : "";
  if (!mint) return null;
  const stats = item.stats ?? {};
  const mcap = positiveDecimalOrNull(stats.market_cap);
  const holders =
    typeof stats.holders === "number" && Number.isFinite(stats.holders)
      ? stats.holders
      : null;
  return {
    id: `trends-${mint}`,
    launchpadId: "trends",
    symbol: String(item.symbol || "").trim() || mint.slice(0, 6),
    name:
      String(item.name || "").trim() ||
      String(item.symbol || "").trim() ||
      mint.slice(0, 8),
    mint,
    icon:
      typeof item.image === "string" && item.image.trim()
        ? item.image.trim()
        : null,
    status: mapTrendsMigrate(stats.migrate_status),
    priceUsd: positiveDecimalOrNull(stats.price),
    change24hPct: null,
    mcapUsd: mcap,
    fdvUsd: mcap,
    volume24hUsd: positiveDecimalOrNull(stats.volume_24h_usd),
    liquidityUsd: null,
    holders,
    holdersDelta24h: null,
    ageHours: ageHoursFromUnix(item.created_at),
    rangeLowUsd: null,
    rangeHighUsd: null,
    rangePos: null,
    spark24h: null,
    draft: false,
  };
}
