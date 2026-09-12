import { DBC_021_CUTOFF_ISO, DBC_PROGRAM_ID } from "./constants.mjs";
import { loadQuoteMints } from "./quote-mints.mjs";

/**
 * One-shot DBC initialize backfill stub (SPEC §5.2 / §8).
 *
 * Fail closed:
 * - HELIUS_API_KEY missing → empty result, no invented pools
 * - key present but walk not implemented → empty filtered result, no invented pools
 * Keep only pools whose quote_mint ∈ seed and created_at ≥ cutoff (when implemented).
 */
export async function backfillOnce(opts = {}) {
  const heliusApiKey = (opts.heliusApiKey ?? process.env.HELIUS_API_KEY ?? "").trim();
  const programId = (opts.programId ?? process.env.DBC_PROGRAM_ID ?? DBC_PROGRAM_ID).trim();
  const cutoffIso = (opts.cutoffIso ?? process.env.DBC_021_CUTOFF_ISO ?? DBC_021_CUTOFF_ISO).trim();
  const allowlist = loadQuoteMints(opts.seedPath);
  const allowlistCount = allowlist.length;

  const empty = {
    ok: true,
    programId,
    cutoffIso,
    allowlistCount,
    pools: [],
    configs: [],
  };

  if (!heliusApiKey) {
    return {
      ...empty,
      skipped: true,
      reason: "HELIUS_API_KEY missing — fail closed, no pools invented",
    };
  }

  // Real Helius parsed-tx / getSignaturesForAddress walk is not implemented.
  // Returning an empty filtered set is intentional — never synthesize pools.
  return {
    ...empty,
    skipped: false,
    stub: true,
    reason:
      "Helius DBC initialize walk not implemented — empty filtered result (no fake pools)",
  };
}
