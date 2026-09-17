# Plan: Native masonry feed, drop iframe lag, hide dex-event spam

## Goal
meteora.fyi ecosystem feed is a **3-column native card grid** again, **not** a single column of Tweet.html iframes; Dex Events / KOL SignalX bots are gone from the top; scrolling is not janky.

## Scope
### In
- RWAScreener `ecosystem-feed.tsx`, `globals.css` (eco-feed block), `ecosystem-feed/route.ts` cache
- meteora-intel `ecosystem-anchor.ts`, `classifier.ts`, `site-data.ts`, `queries.ts` + tests
- Deploy intel **web** (filter) + RWAScreener **web** (UI)

### Out
- Reverting list-feed harvest
- Bucket tags / post counts (stay off)
- widgets.js / Tweet.html

## Approach
Lag is **one X embed iframe per tweet** (mini X app). Native HTML cards + CSS `column-count` masonry is the previous layout. Hide spam with a hard rule (handles + `dexevents.fun` / `METEORA_PAIR_` / CHECK EVENTS / KOL Signal templates) in `filterFeed` so already-stored posts drop immediately; same rule in `classifyPost` + query `-url:dexevents.fun`. Bust API cache with `no-store` and no in-memory TTL.

## Blast radius
Public homepage feed + intel `/api/feed`. No DB migration.

## E2E checklist
- [ ] Desktop: 3-column cards, not 550px iframe stack
- [ ] Scroll is native (no twitter iframes in feed)
- [ ] Dex Screener / Events Dex Margin templates not on page 1
- [ ] Infinite scroll still appends
- [ ] Official / replies / windows still work

## Verification
```bash
cd meteora-intel && npm run typecheck && npm test
# deploy intel web + rwascreener web
curl -sS https://www.meteora.fyi/api/ecosystem-feed?lane=ecosystem&type=posts&limit=12
```
Browser: kitesurf snapshot of feed section.
