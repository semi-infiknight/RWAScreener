#!/usr/bin/env node
/**
 * DBC backfill stub runner (SPEC §5.2).
 * Fail closed without HELIUS_API_KEY — never invents pools.
 */
import { backfillOnce } from "../packages/dbc/index.mjs";

const result = await backfillOnce();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
