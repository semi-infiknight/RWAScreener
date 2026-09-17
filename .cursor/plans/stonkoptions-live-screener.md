# Plan: Wire Stonk Options live pad metrics

## Goal
Stonk Options (`stardotfun`) homepage + pad screener show live coin counts and USD metrics now the pad is already launching on DBC.

## Why they were stuck
`screenerLive: false`, `status: integrating`, no `loadPadTokens` case, no `/api/pads/stardotfun`, columns `PENDING`. Client never polls; summary returns empty dashes.

## Approach
Use their public indexer catalog (`https://indexer.canary.stonkoptions.xyz/v2/catalog?sort=new&limit=50` + cursor) — ships `priceUsd` / `marketCapUsd` / `volume24hUsd` / `holdersCount`. Do not invent USD from quote-only `/api/markets` fields. Keep pad id `stardotfun`.

## Files
| Path | Change |
|------|--------|
| `lib/stonkoptions.ts` | Fetch + map catalog → `TokenRow` |
| `app/api/pads/stardotfun/route.ts` | Same shape as other pad routes |
| `lib/pad-summary.ts` | `case "stardotfun"` |
| `lib/screener-columns.ts` | price, fdv, volume, holders, age |
| `data/projects.json` | `screenerLive: true`, `status: live`, website `stonkoptions.xyz` |
| `data/README.md` | Drop “empty until live” |

## Out
Fee claimer labels, quote-screener pool index, SOL-vs-stock filter (show the pad’s DBC catalog).

## Verify
- `npx tsc --noEmit`
- Live fetch: ≥1 page, bonding/graduated from `phase`
- Browser: `/projects/stardotfun` table + homepage pad row
