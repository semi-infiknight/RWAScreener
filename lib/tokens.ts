import raw from "../data/tokens.json";

export type TokenStatus = "bonding" | "graduated";

export type TokenRow = {
  id: string;
  launchpadId: string;
  symbol: string;
  name: string;
  status: TokenStatus;
  priceUsd: number;
  change24hPct: number;
  mcapUsd: number;
  fdvUsd: number;
  volume24hUsd: number;
  liquidityUsd: number;
  holders: number;
  holdersDelta24h: number;
  ageHours: number;
  rangeLowUsd: number;
  rangeHighUsd: number;
  rangePos: number;
  spark24h: number[];
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

export function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function formatAge(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}
