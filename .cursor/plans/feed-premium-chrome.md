# Plan: Quiet the feed chrome so posts read as the product

## Goal
The live feed feels editorial: posts first, filters as instruments, acid as a hairline — not a lime dashboard.

## Scope
### In
- `meteora-intel/src/site-html.ts` markup + CSS
- `meteora-intel/test/site-html.test.ts` assertions for chrome/cards
- Local browser smoke at 1280 / 768 / 375
- Deploy web to Railway after green tests (this is the surface they audit)

### Out
- Brand-design / new typefaces
- Classifier, queries, ingest, pagination size
- Leaderboard data model (visual quiet only)

## Approach
Lowest blast radius: HTML/CSS only. Native `<select>` for buckets (no JS framework). Keep IBM Plex + olive tokens; stop using acid as fill.

## Files / modules
| Path | Change |
|------|--------|
| `src/site-html.ts` | Remove ticker/stats/kicker; text tabs; bucket select; recomposed cards |
| `test/site-html.test.ts` | Assert no ticker/KPI lime fills; topic caption not name-row badge |

## Blast radius
UI-only. Empty/error states preserved. URL query params unchanged (`window`, `lane`, `type`, `bucket`, `q`, `page`).

## E2E checklist
- [ ] Feed loads; masonry cards start high on the page
- [ ] No marquee, no 4-KPI grid, no lime filled Feed/All chips
- [ ] Lane, posts/replies, window, search, bucket still filter via URL
- [ ] Names not truncated by badges; topic is a caption
- [ ] Media flush to card edges
- [ ] Leaderboard still lists accounts; official lane still works
- [ ] Mobile 375: filters wrap, 1-col masonry

## Verification
```bash
cd meteora-intel && npm run typecheck && npm test
```
Kitesurf: live or local `/`, `/leaderboard`, bucket select, official lane.

## Rollback
Redeploy previous web deployment if chrome is wrong.

## Open questions
- None — user approved the five-fix list.
