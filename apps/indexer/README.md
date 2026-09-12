# indexer stub

`node apps/indexer/index.mjs` (or `npm run backfill:dbc`) calls `backfillOnce()`.

Without `HELIUS_API_KEY` the stub exits 0 with `pools: []` (fail closed).
