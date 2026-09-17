# Plan: Drop LaunchOnSF competitor from ecosystem feed

## Goal
`@LaunchOnSF` / StonkFun (Backpack RWA pad) must not appear on the meteora.fyi ecosystem feed. It is not a Meteora pad.

## Why it showed up
`launchonsf` was wrongly listed as a StonkOptions alias in `SCREENER_PAD_HANDLES` and `from:LaunchOnSF` in pad-watch search. Tracked-pad bypass kept those posts even without the word Meteora.

Meteora-side StonkOptions stays: `@getstonkoptions`, `@stardotfun`, star.fun.

## Files
- `packages/intel/src/ecosystem-anchor.ts` — remove handle; add competitor denylist
- `packages/intel/src/queries.ts` — drop `from:LaunchOnSF`
- `packages/intel/src/site-data.ts` — hard-hide competitor accounts
- `packages/intel/src/vesper-interest.ts` — skip harvesting them
- tests in ecosystem-anchor + site-data

## Verify
`packages/intel` typecheck + test. Deploy intel (feed filter) + scanner (stop harvesting).
