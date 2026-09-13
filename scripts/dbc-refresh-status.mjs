#!/usr/bin/env node
/**
 * One-shot VirtualPool → pools.status refresh (CreatedPool/3 = graduated).
 * Requires HELIUS_API_KEY + DATABASE_URL (public/proxy reachable from Mac).
 * Fail closed; never prints secrets.
 */
import { refreshPoolStatuses, loadDotEnv } from "../packages/dbc/index.mjs";

loadDotEnv();
const result = await refreshPoolStatuses();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
