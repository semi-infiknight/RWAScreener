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
  volume24hUsd: number;
  holders: number;
  ageHours: number;
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
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

export function formatAge(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  return `${d}d`;
}
