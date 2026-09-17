import type { TokenRow } from "./tokens";

export type StonkCatalogRow = {
  marketId?: string;
  baseMint?: string;
  name?: string | null;
  symbol?: string | null;
  imageUrl?: string | null;
  phase?: string | null;
  listedAt?: string | null;
  priceUsd?: string | number | null;
  marketCapUsd?: string | number | null;
  fdvUsd?: string | number | null;
  volume24hUsd?: string | number | null;
  holdersCount?: number | null;
  dbcPoolAddress?: string | null;
};

export function decimalOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Treat placeholder zeros as missing (same as OTC / pad aggregates). */
export function positiveDecimalOrNull(v: unknown): number | null {
  const n = decimalOrNull(v);
  if (n == null || n === 0) return null;
  return n;
}

export function mapStonkPhase(phase: string | null | undefined): TokenRow["status"] {
  const p = String(phase || "").trim().toLowerCase();
  if (p === "damm_v2" || p === "dammv2" || p === "graduated") return "graduated";
  return "bonding";
}

function ageHoursFromIso(listedAt: string | null | undefined): number | null {
  if (!listedAt || typeof listedAt !== "string") return null;
  const ms = Date.parse(listedAt);
  if (!Number.isFinite(ms)) return null;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, hours);
}

export function mapStonkCatalogRow(row: StonkCatalogRow): TokenRow | null {
  const mint = typeof row.baseMint === "string" ? row.baseMint.trim() : "";
  if (!mint) return null;
  const mcap = positiveDecimalOrNull(row.marketCapUsd);
  const fdv = positiveDecimalOrNull(row.fdvUsd);
  const holders =
    typeof row.holdersCount === "number" && Number.isFinite(row.holdersCount)
      ? row.holdersCount
      : null;
  const id =
    typeof row.marketId === "string" && row.marketId.trim()
      ? `stardotfun-${row.marketId.trim()}`
      : `stardotfun-${mint}`;
  return {
    id,
    launchpadId: "stardotfun",
    symbol: String(row.symbol || "").trim() || mint.slice(0, 6),
    name:
      String(row.name || "").trim() ||
      String(row.symbol || "").trim() ||
      mint.slice(0, 8),
    mint,
    icon: typeof row.imageUrl === "string" && row.imageUrl.trim() ? row.imageUrl.trim() : null,
    status: mapStonkPhase(row.phase),
    priceUsd: positiveDecimalOrNull(row.priceUsd),
    change24hPct: null,
    mcapUsd: mcap,
    fdvUsd: fdv ?? mcap,
    volume24hUsd: positiveDecimalOrNull(row.volume24hUsd),
    liquidityUsd: null,
    holders,
    holdersDelta24h: null,
    ageHours: ageHoursFromIso(row.listedAt),
    rangeLowUsd: null,
    rangeHighUsd: null,
    rangePos: null,
    spark24h: null,
    draft: false,
  };
}
