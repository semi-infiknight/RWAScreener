# Staging environment — staging.meteora.fyi

## Purpose
Program-sourced DBC stock-quote screener (indexer / Postgres), separate from prod pad-API SoT on `meteora.fyi`.

## Stack
- Domain: `staging.meteora.fyi` → Railway **web** service (same deploy as prod app)
- Host rewrite: `middleware.ts` rewrites `/` → `/staging` on staging host
- Data: Postgres (`DATABASE_URL`) + Helius worker backfill
- Graduated SoT: **CreatedPool only** (`migration_progress === 3`)

## DNS (Porkbun)
- `CNAME staging` → Railway target (see `railway domain status staging.meteora.fyi -s web`)
- `TXT _railway-verify.staging` → Railway verify token

## Deploy
```bash
railway up -s web -y -c
```
Prod `/` must remain pad scrapers until Semi go-live.

## Checks
- https://staging.meteora.fyi/ → staging screener
- https://staging.meteora.fyi/api/staging/launchpads
- https://www.meteora.fyi/ → prod pad homepage (unchanged)
