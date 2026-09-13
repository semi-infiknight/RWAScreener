/** Staging DBC screener constants (SPEC §3 / §7). Prod pad routes stay untouched. */

export const DBC_PROGRAM_ID = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
export const DBC_021_CUTOFF_ISO = "2026-09-09T03:00:00.000Z";

/** Never allow as quote — even if somehow present in a data artifact. */
export const BLOCKED_QUOTE_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // wrapped SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT (also out of niche)
]);

export const CUTOFF_MS = Date.parse(DBC_021_CUTOFF_ISO);
