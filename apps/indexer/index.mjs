/**
 * Indexer entry stub (SPEC §8 apps/indexer).
 * Runs one fail-closed backfillOnce(); no Helius spend, no fake pools.
 */
import { backfillOnce } from "../../packages/dbc/index.mjs";

const result = await backfillOnce();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
