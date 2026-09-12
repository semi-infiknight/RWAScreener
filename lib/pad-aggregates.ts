import type { TokenRow } from "./tokens";

/** Numeric pad rollup from live TokenRow[] — null means feed had no values (show —). */
export type PadAggregate = {
  coins: number;
  bonding: number;
  graduated: number;
  mcapUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
};

function sumFinite(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

/** Aggregate only from real TokenRow fields — never invent metrics. */
export function aggregatePadMetrics(tokens: TokenRow[]): PadAggregate {
  return {
    coins: tokens.length,
    bonding: tokens.filter((t) => t.status === "bonding").length,
    graduated: tokens.filter((t) => t.status === "graduated").length,
    mcapUsd: sumFinite(tokens.map((t) => t.mcapUsd)),
    volume24hUsd: sumFinite(tokens.map((t) => t.volume24hUsd)),
    liquidityUsd: sumFinite(tokens.map((t) => t.liquidityUsd)),
  };
}

export const EMPTY_PAD_AGGREGATE: PadAggregate = {
  coins: 0,
  bonding: 0,
  graduated: 0,
  mcapUsd: null,
  volume24hUsd: null,
  liquidityUsd: null,
};
