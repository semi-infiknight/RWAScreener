# Plan: Drop Bags from DBC screener; add Purps + Trends

## Goal
Homepage DBC scanner lists pads that actually launch on Meteora DBC: remove Bags (DAMM v2 / not DBC), add Purps and Trends with live pad-API metrics.

## Scope
### In
- `screenerLive: false` for Bags; homepage only lists live pads
- Remove `$BAGS` from platform-token column
- Purps: `GET https://purps.lol/api/public/coins/` (paginate 50), keep `origin` launchpad|meteora and Solana
- Trends: `GET https://api.trends.fun/v1/token/ranking` (required Origin/X-Platform headers)
- PURPS mint (Jupiter-verified) in `platform-tokens.json`

### Out
- On-chain BAGS DAMM mcap
- Invented Trends platform token
- Intel query / Railway intel redeploy

## Approach
Follow OTC Desks / Stonk Options: map-only files + tests, cached pad feed, summary switch, screener columns that match real fields.

## Files
| Path | Change |
|------|--------|
| `data/projects.json` | Bags off screener; Purps + Trends live |
| `data/platform-tokens.json` | Drop BAGS; add PURPS |
| `lib/purps*.ts` `lib/trends*.ts` | Fetch + map |
| `lib/pad-summary.ts` `lib/screener-columns.ts` | Wire pads |
| `app/api/pads/{purps,trends}/route.ts` | JSON feeds |
| `app/page.tsx` | Pass screener-live projects only |

## Verify
`npm test` + typecheck; curl local pad APIs; homepage in browser.
