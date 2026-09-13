#!/usr/bin/env node
/**
 * DBC initialize-tx backfill (SPEC §5.2).
 * Loads HELIUS_API_KEY from .env / .env.local — fail closed (exit 1) if missing.
 * Refreshes data/dbc-backfill-result.json; optional DATABASE_URL upsert.
 * Never invents pools or fee_claimer labels; never prints the API key.
 */
import { backfillOnce, loadDotEnv } from "../packages/dbc/index.mjs";

loadDotEnv();
const result = await backfillOnce();
const summary = {
  ok: result.ok,
  skipped: result.skipped || false,
  stub: result.stub || false,
  reason: result.reason,
  programId: result.programId,
  cutoffIso: result.cutoffIso,
  cutoffSlot: result.cutoffSlot,
  allowlistCount: result.allowlistCount,
  configCount: result.configs?.length ?? 0,
  poolCount: result.pools?.length ?? 0,
  stats: result.stats,
  artifactPath: result.artifactPath,
  db: result.db,
  samplePools: (result.pools || []).slice(0, 5).map((p) => ({
    address: p.address,
    quote_mint: p.quote_mint,
    base_mint: p.base_mint,
    config: p.config,
    created_at: p.created_at,
    initialize_signature: p.raw?.initialize_signature,
  })),
  sampleConfigs: (result.configs || []).slice(0, 5).map((c) => ({
    address: c.address,
    quote_mint: c.quote_mint,
    fee_claimer: c.fee_claimer,
  })),
};
console.log(JSON.stringify(summary, null, 2));
process.exit(result.ok ? 0 : 1);
