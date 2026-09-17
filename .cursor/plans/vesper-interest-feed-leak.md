# Plan: Close Vesper-interest public-feed leak

## Goal
Homepage **Meteora Ecosystem feed** stops dumping unrelated timelines (hustle quotes, Avalanche, Art-on-Solana) just because Vesper `@`-mentioned the author.

## Scope
### In
- `filterFeed`: Vesper-interest is **not** a noise/DBC-lane bypass
- Harvest: only quote/reply targets, not mention-only `@`
- Skip obvious non-builder handles (`support`, known personal leaks)
- Tests + ETHOS/TODO note

### Out
- Changing newest-first rank
- Following/Likes APIs
- Removing `GET /api/vesper-interest` (API can still list who she `@`’d)
- Tracked pad/builder bypass (StonkOptions mislabeled noise stays)

## Approach
Discovery prior ≠ homepage membership. Posts from interest accounts must pass the same gates as everyone else. Tracked pads still bypass BGE.

## Files
| Path | Change |
|------|--------|
| `packages/intel/src/site-data.ts` | Drop interest bypass |
| `packages/intel/src/vesper-interest.ts` | Harvest quote/reply only; expand SKIP |
| `packages/intel/test/site-data.test.ts` | Leak cases; DBC still shows |
| `packages/intel/test/vesper-interest.test.ts` | Mention-only not harvested |
| `docs/ETHOS.md`, `docs/TODO.md` | Record the closed leak |

## Blast radius
Public `/api/feed` only. Already-stored DearS/Marc/ghosty rows stay in JSONL but drop from the feed after intel deploy. No DB migration.

## E2E checklist
- [ ] DearS_o_n / marccolcer Avalanche / degenghosty Art posts not in ecosystem lane
- [ ] Ember / StonkOptions / DBC builder posts still in
- [ ] Official lane unchanged

## Verification
```bash
cd packages/intel && npm test && npm run typecheck
```

## Rollback
Revert the commit; old bypass returns.

## Open questions
None — operator asked to fix leaks and focus.
