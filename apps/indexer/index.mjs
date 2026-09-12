/**
 * Indexer entry (SPEC §8 apps/indexer).
 * Runs one fail-closed backfillOnce() via Helius initialize-tx walk.
 */
import { backfillOnce, loadDotEnv } from "../../packages/dbc/index.mjs";

loadDotEnv();
const result = await backfillOnce();
const summary = {
  ok: result.ok,
  skipped: result.skipped || false,
  reason: result.reason,
  poolCount: result.pools?.length ?? 0,
  configCount: result.configs?.length ?? 0,
  stats: result.stats,
  artifactPath: result.artifactPath,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(result.ok ? 0 : 1);
