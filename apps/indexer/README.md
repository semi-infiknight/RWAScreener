# apps/indexer

Worker entry stub. Runs `backfillOnce()` (Helius DBC initialize-tx walk).

```bash
node apps/indexer/index.mjs
# or
npm run backfill:dbc
```

Requires `HELIUS_API_KEY` in `.env` / `.env.local`. Fail closed when missing.
