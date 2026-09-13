# apps/indexer

DBC worker: migrate Postgres schema, Helius `backfillOnce` → upsert, webhook ACK stub.

## Commands

```bash
# Apply packages/db/migrations/001_init.sql
node apps/indexer/index.mjs migrate

# Helius backfill (fail closed without HELIUS_API_KEY) + upsert if DATABASE_URL set
node apps/indexer/index.mjs backfill
# or:
npm run backfill:dbc

# Upsert existing gitignored artifact (no Helius call)
node apps/indexer/index.mjs ingest
node apps/indexer/index.mjs ingest /path/to/dbc-backfill-result.json

# Webhook stub (PORT=8080) — POST /api/webhooks/helius
node apps/indexer/index.mjs serve

# Default one-shot: migrate (if DB) + backfill + ingest
node apps/indexer/index.mjs
```

## Env

See repo `.env.example`:

| Var | Required | Notes |
| --- | --- | --- |
| `HELIUS_API_KEY` | for backfill | Missing → fail closed, no invented pools |
| `DATABASE_URL` | for migrate/ingest | Missing → artifact-only / serve without enqueue |
| `DBC_PROGRAM_ID` | optional | defaults to Meteora DBC |
| `DBC_021_CUTOFF_ISO` | optional | default `2026-09-09T03:00:00.000Z` |
| `HELIUS_WEBHOOK_SECRET` | optional | auth for webhook stub |
| `PORT` | optional | serve listen port (8080) |
| `BACKFILL_STRICT` | optional | `1` → exit 1 when HELIUS key missing |

Never commit secrets.

## Docker / Railway

```bash
docker build -f apps/indexer/Dockerfile -t rwascreener-indexer .
docker run --env-file .env -p 8080:8080 rwascreener-indexer
```

- `apps/indexer/Dockerfile` — build from **repo root**
- `apps/indexer/railway.json` — Dockerfile builder + `serve` start
- `apps/indexer/nixpacks.toml` — Nixpacks alternative

One-shot backfill on Railway: override start to `node apps/indexer/index.mjs backfill`.
