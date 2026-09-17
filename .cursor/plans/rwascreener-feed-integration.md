# Plan: Meteora Intel feed inside RWAScreener

## Goal (one sentence)
A live Meteora ecosystem feed (classified posts from meteora-intel) renders below the "Build on Meteora DBC" button on RWAScreener — staging first, then main.

## Architecture
- RWAScreener: Next.js 15 App Router + TypeScript + Redis
- Meteora-intel: standalone Node HTTP server at `https://web-production-a5814.up.railway.app/api/feed`
- Feed data flows: meteora-intel `/api/feed` → RWAScreener `/api/ecosystem-feed` (Redis-cached 5 min) → client component

## Staging approach (no lag)
1. **`app/api/ecosystem-feed/route.ts`** (new) — server-side fetch from `$METEORA_INTEL_URL/api/feed`, Redis cache 5 min (same pattern as `lib/pad-cache.ts`), memory fallback if no Redis
2. **`app/components/ecosystem-feed.tsx`** (new) — client component, fetches `/api/ecosystem-feed`, renders X-embed-anatomy cards (avatar, handle, time, text, media, engagement footer, bucket badge). Lane toggle (ecosystem/official), time window, bucket filter — same as meteora-intel but inline
3. **Insert `<EcosystemFeed />`** below `footer-cta` in `ecosystem-explorer.tsx` (~L555)
4. **Also insert in `staging-screener.tsx`** — staging host shows the feed too
5. **`METEORA_INTEL_URL`** env var on RWAScreener Railway (production + staging)
6. Deploy to RWAScreener Railway → verify at `staging.meteora.fyi` first, then `www.meteora.fyi`

## Railway migration (phase 2, after staging verified)
- Move `scanner` service from `meteora-intel` Railway project → `rwascreener` Railway project
- Point scanner's `INGEST_URL` at meteora-intel's `web` service (still runs as the data API)
- Later: move `web` service too, or fold the classifier into RWAScreener's Next.js API routes

## Why no lag
- Redis cache (5 min TTL) — the external fetch happens once per 5 min, not per request
- Client component renders from cached API response — no loading spinner for first paint
- Meteora-intel's `/api/feed` reads a JSONL file (fast, no DB) — even a cache miss is ~100ms

## Files in scope
- `app/api/ecosystem-feed/route.ts` (new)
- `app/components/ecosystem-feed.tsx` (new)
- `app/ecosystem-explorer.tsx` (modify — insert feed)
- `app/staging/staging-screener.tsx` (modify — insert feed)
- `.env.example` (add METEORA_INTEL_URL)

## Out of scope (for now)
- Moving meteora-intel code into RWAScreener repo
- Postgres-backed store (keep JSONL + volume)
- Multilingual classifier model
