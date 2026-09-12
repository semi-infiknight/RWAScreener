/**
 * Per-pad screener columns — only fields the reverse-engineered API can supply.
 * Update this when a pad feed gains/loses real fields. Never show a column of all "—".
 */

export type ScreenerColumnId =
  | "price"
  | "fdv"
  | "volume"
  | "spark"
  | "range"
  | "liquidity"
  | "age"
  | "holders"
  | "buy";

export type ScreenerColumns = Record<ScreenerColumnId, boolean>;

const ALL_OFF: ScreenerColumns = {
  price: false,
  fdv: false,
  volume: false,
  spark: false,
  range: false,
  liquidity: false,
  age: false,
  holders: false,
  buy: false,
};

/** Ethics: launches + board/enrich + token-info (no spark/range/holders). */
const ETHICS: ScreenerColumns = {
  ...ALL_OFF,
  price: true,
  fdv: true,
  volume: true,
  liquidity: true,
  age: true,
  buy: false,
};

/** Ember /cooking markets: price, mcap, vol, holders, age (no liq/spark/range). */
const EMBER: ScreenerColumns = {
  ...ALL_OFF,
  price: true,
  fdv: true,
  volume: true,
  holders: true,
  age: true,
  buy: false,
};

/** Bags public launches: identity + icon + age only for now. */
const BAGS: ScreenerColumns = {
  ...ALL_OFF,
  age: true,
  buy: false,
};

/** Perpspad /tokens catalog: price, mcap, age (no vol/liq/holders). */
const PERPSPAD: ScreenerColumns = {
  ...ALL_OFF,
  price: true,
  fdv: true,
  age: true,
  buy: false,
};

/** ClawPump /api/tokens: price, mcap, vol, liq, age (no %/holders/spark). */
const CLAWPUMP: ScreenerColumns = {
  ...ALL_OFF,
  price: true,
  fdv: true,
  volume: true,
  liquidity: true,
  age: true,
  buy: false,
};

/** LFOwn /api/launches: identity + icon + age + raised-USD proxy in FDV (not token mcap); no price/vol. */
const LFGOWN: ScreenerColumns = {
  ...ALL_OFF,
  fdv: true,
  age: true,
  buy: false,
};

/** Unwired pads — name only until their API is mapped. */
const PENDING: ScreenerColumns = {
  ...ALL_OFF,
  buy: false,
};

const BY_PAD: Record<string, ScreenerColumns> = {
  ethics: ETHICS,
  embercurve: EMBER,
  bags: BAGS,
  perpspad: PERPSPAD,
  clawpump: CLAWPUMP,
  lfgown: LFGOWN,
  stardotfun: PENDING,
};

export function screenerColumnsFor(launchpadId: string): ScreenerColumns {
  return BY_PAD[launchpadId] ?? PENDING;
}

export function defaultSortFor(cols: ScreenerColumns): {
  key: "fdvUsd" | "volume24hUsd" | "change24hPct" | "liquidityUsd" | "ageHours" | "holders";
  asc: boolean;
} {
  if (cols.volume) return { key: "volume24hUsd", asc: false };
  if (cols.fdv) return { key: "fdvUsd", asc: false };
  if (cols.age) return { key: "ageHours", asc: true };
  if (cols.holders) return { key: "holders", asc: false };
  return { key: "ageHours", asc: true };
}
