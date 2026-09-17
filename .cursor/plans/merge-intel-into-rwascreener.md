# Plan: Fold meteora-intel into RWAScreener

## Goal
RWAScreener repo + Railway `rwascreener` owns the X intel API, volume, and hourly scanner. meteora.fyi feed keeps working. meteco folder and Railway `meteora-intel` can be deleted **after** live verify.

## Approach
Keep intel as a **Node service** (`packages/intel`), not inside Next.js (BGE + cron + volume). Add `intel` + `intel-scanner` on the rwascreener project. Point `METEORA_INTEL_URL` at the new intel public URL. Rehydrate `/data` from old `/api/export`.

## Out
- Deleting old Railway until new `/api/feed` count matches
- Folding BGE into Next.js
- Git commit unless needed (will commit if user needs GitHub deploy; otherwise `railway up`)

## E2E
- [ ] `packages/intel` typecheck + tests
- [ ] intel `/health` + `/api/feed` 200, count ≥ current
- [ ] www.meteora.fyi `/api/ecosystem-feed` returns posts from new URL
- [ ] scanner cron present
