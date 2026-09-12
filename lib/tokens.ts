import raw from "../data/tokens.json";

export type TokenStatus = "bonding" | "graduated";

/** Nullable metrics: real Bags rows ship identity only until priced. */
export type TokenRow = {
  id: string;
  launchpadId: string;
  symbol: string;
  name: string;
  status: TokenStatus;
  /** Solana mint when known (Bags real rows). */
  mint?: string;
  /** Token image URL when the pad API provides one. */
  icon?: string | null;
  priceUsd: number | null;
  change24hPct: number | null;
  mcapUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  holders: number | null;
  holdersDelta24h: number | null;
  ageHours: number | null;
  rangeLowUsd: number | null;
  rangeHighUsd: number | null;
  rangePos: number | null;
  spark24h: number[] | null;
  draft: boolean;
};

type TokensFile = {
  updatedAt: string;
  disclaimer: string;
  tokens: TokenRow[];
};

const data = raw as TokensFile;

export const tokensDisclaimer = data.disclaimer;
export const tokensUpdatedAt = data.updatedAt;

export function tokensForLaunchpad(launchpadId: string): TokenRow[] {
  return data.tokens.filter((t) => t.launchpadId === launchpadId);
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

export function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function formatAge(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 0) return "—";
  // Sub-hour: minutes (pad feeds store fractional ageHours).
  if (hours < 1) {
    const mins = Math.max(0, Math.round(hours * 60));
    return `${mins}m`;
  }
  if (hours < 24) return `${Math.round(hours)}h`;
  const d = Math.floor(hours / 24);
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

/** Sort helper: missing metrics sink to the bottom regardless of asc/desc intent via callers. */
export function metricOrNaN(n: number | null | undefined): number {
  return n == null || Number.isNaN(n) ? Number.NEGATIVE_INFINITY : n;
}
