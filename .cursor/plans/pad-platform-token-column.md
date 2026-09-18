# Plan: Homepage DBC scanner column for launchpad platform token + mcap

## Goal
Show each launchpad’s own platform token ticker and USD market cap on the homepage DBC scanner table.

## Scope
### In
- Allowlist of verified mints only (`data/platform-tokens.json`)
- Jupiter token search mcap (fail closed)
- Homepage column + sort
- Tests for seed validation / mcap parse

### Out
- Invented mints (Bags, Revshare until website-matched)
- Mixing into pad launch-token summary API
- DexScreener / competitor product names in UI

## Approach
Seed mint+symbol per `launchpadId`. Fetch mcap from Jupiter lite token search by exact mint. Pads without a seed show —. STAR is Star.fun’s token (Stonk Options ecosystem / buybacks), not a Stonk Options-issued token.

## Files / modules
| Path | Change |
|------|--------|
| `data/platform-tokens.json` | Allowlist |
| `lib/platform-tokens.ts` | Load, fetch, cache |
| `lib/platform-tokens.test.ts` | Parse + mint checks |
| `app/api/pads/platform-tokens/route.ts` | JSON |
| `app/ecosystem-explorer.tsx` | Column |
| `app/page.tsx` | SSR peek |
| `data/README.md` | Seed note |

## Blast radius
Homepage table + one public GET. No DB.

## E2E checklist
- [ ] Seeded pads show ticker + mcap
- [ ] Bags / Revshare show —
- [ ] Sort by platform mcap
- [ ] Pad launch mcaps unchanged

## Verification
```bash
npm test
npx tsc --noEmit
curl /api/pads/platform-tokens
```

## Rollback
Revert the commit; column disappears.

## Open questions
- None blocking — omit unverified mints.
