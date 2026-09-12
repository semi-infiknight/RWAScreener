import type { TokenRow } from "./tokens";

/** Numeric pad rollup from live TokenRow[] — null means unknown / failed (show —). */
export type PadAggregate = {
  coins: number | null;
  bonding: number | null;
  graduated: number | null;
  mcapUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
};

function sumFinite(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  // All placeholder zeros (e.g. RevShare all-tokens marketCap:0) → show — not $0.000000.
  if (sum === 0 && nums.every((n) => n === 0)) return null;
  return sum;
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

/** Non-live / placeholder — UI gates on live so zeros never flash as real. */
export const EMPTY_PAD_AGGREGATE: PadAggregate = {
  coins: 0,
  bonding: 0,
  graduated: 0,
  mcapUsd: null,
  volume24hUsd: null,
  liquidityUsd: null,
};

/** Fetch/error stand-in — counts are null so UI shows — (not loaded zeros). */
export const FAILED_PAD_AGGREGATE: PadAggregate = {
  coins: null,
  bonding: null,
  graduated: null,
  mcapUsd: null,
  volume24hUsd: null,
  liquidityUsd: null,
};
