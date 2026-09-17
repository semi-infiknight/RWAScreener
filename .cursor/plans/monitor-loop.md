# Plan: turn meteora-intel into an always-on monitor

## Goal (one sentence)
The live site stays fresh by itself: a Railway cron service scans X **hourly** and pushes new posts to the web service, which classifies them semantically and persists them to a volume — no manual `backfill && railway up`.

## Chosen shape (user decided)
- **Architecture:** separate Railway **cron service** (`scanner`) — not an in-process loop
- **Cadence:** hourly (`0 * * * *`)

## Key constraint discovered
Railway volumes attach to **one** service — scanner and site cannot share a volume. So:
- **web** owns the persistent store (volume at `/data`) and the classifier (model already a dep there)
- **scanner** is stateless and fetch-only (no transformer model → fast cold start); it POSTs raw posts to the web service

## Changes

### Code (`meteora-intel/`)
1. `src/site-server.ts` — add `POST /api/ingest`:
   - Auth: `x-ingest-token` header vs `INGEST_TOKEN` env (timing-safe compare); 401 otherwise
   - Body: `{posts: RawPost[]}` → lazy `warmupClassifier()`, `classifyText()` each, skip `knownMentionIds()`, append new to store
   - Returns `{received, new, skipped}`; logs one line per ingest
2. `src/push-scan.ts` (new) — fetch-only scanner entry:
   - Recent search over `SEARCH_QUERIES`, `start_time = now - 75min` (overlap; server dedups), 1 page × 25/query
   - POST batches to `$INGEST_URL` with token; prints summary; exit non-zero on failure so cron run shows FAILED
3. `test/site-ingest.test.ts` (new): 401 without token, ingest classifies + persists, re-POST dedups, noise lands suppressed
4. `package.json`: `"push-scan": "tsx src/push-scan.ts"`

### Railway (project `meteora-intel` `787deca8`, env production)
1. Volume `intel-data` → attach to `web`, mount `/data`; set `METEORA_INTEL_DATA_DIR=/data`, `INGEST_TOKEN=<random>` on `web`; redeploy web (`railway up`) — first boot re-seeds `/data` from `fixtures/seed-mentions.jsonl`
2. New service `scanner` (`railway add --service scanner`); vars: `X_BEARER_TOKEN`, `INGEST_URL=https://web-production-a5814.up.railway.app/api/ingest`, same `INGEST_TOKEN`
3. Scanner config patch: `deploy.startCommand="npx tsx src/push-scan.ts"`, `deploy.cronSchedule="0 * * * *"`, `restartPolicyType=NEVER`, drop healthcheck (short-lived runs)
4. Deploy scanner (`railway up -s scanner`) — the deploy itself is run #1; verify via logs + site count

## Verification (receipts)
- `npm run typecheck && npm test` (incl. new ingest suite)
- Local E2E: site on scratch `METEORA_INTEL_DATA_DIR` + `INGEST_TOKEN` → `curl POST /api/ingest` 2 demo posts → feed count +2 → re-POST → +0 (dedup) → 401 without token
- Post-deploy: `railway environment config --json` shows cronSchedule; scanner run logs show `posted N`; `curl /api/feed` count ≥ previous; `railway logs -s web` shows ingest line

## Risks / notes
- X credit burn: ~10 queries × 25 results hourly ≈ 6k posts/day max — user picked hourly knowingly; 402 path already surfaces in scanner logs
- Model cache on web is ephemeral (`.cache/`) → first ingest after a redeploy re-downloads BGE (~1 min, lazy, doesn't block healthcheck). Acceptable; can point cache at `/data` later
- `railway.toml` startCommand may fight the scanner's service-level override — re-apply config after first scanner deploy if needed
- Overlap window (75 min) + server-side id dedup = no double-counting

## Out of scope
- Postgres/Redis store, websocket live-push, backfill scheduling, scanner-side classification
