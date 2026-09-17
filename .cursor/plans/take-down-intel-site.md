# Plan: Take down the Intel website; screener is the feed

## Goal
Nobody browses the Meteora Intel site. The only public feed is the DBC screener on meteora.fyi.

## Scope
### In
- `meteora-intel/src/site-server.ts` — `/` and `/leaderboard` 301 → `https://www.meteora.fyi/`
- `test/site-handler.test.ts`
- Railway web healthcheck (must not be `/` once it 301s)
- `AGENTS.md` + `meteora-intel/README.md` live URL

### Out
- Deleting Railway `web` or `scanner` (feed + hourly ingest would die)
- Removing the generated domain (RWAScreener `METEORA_INTEL_URL` still calls `/api/feed`)
- Folding classifier into RWAScreener
- Reverting the earlier Intel chrome restyle (moot once HTML is gone)

## Approach
Keep web as an API + ingest worker. HTML routes redirect. Point healthcheck at `/api/feed` (already 200 JSON) before shipping the 301.

## Blast radius
Public Intel UI only. Volume store, ingest token, scanner cron unchanged.

## E2E
- [ ] `GET https://web-production-a5814…/` → 301 Location meteora.fyi
- [ ] `GET /api/feed` still JSON with count
- [ ] `GET https://www.meteora.fyi/` feed still loads posts
- [ ] Scanner service still present

## Verification
```bash
cd meteora-intel && npm run typecheck && npm test
curl -sSI https://web-production-a5814.up.railway.app/
curl -sS https://web-production-a5814.up.railway.app/api/feed | python3 -c "import json,sys; print(json.load(sys.stdin)['count'])"
```

## Rollback
Revert site-server HTML routes; redeploy web; restore healthcheck `/`.
