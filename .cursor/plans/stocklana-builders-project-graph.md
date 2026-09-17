# Plan: Stocklana DBC builders + project graph

## Goal
Find more ChainRot-class launchpads building on Meteora DBC for Stocklana, harvest their builder-update posts, and start treating intel as a **project knowledge graph** (what each watched account is doing), not only a flat feed.

## Scope
### In
- Watch-list of DBC/stock-quote builders (not just the nine screener pads)
- Stocklana-oriented search query
- List harvest of those handles (7-day timelines, same as pads)
- Feed: watched builders bypass noise/mis-buckets the way pads do
- Seeded project graph + `GET /api/projects` (handle, kind, last posts)
- ETHOS: second brain / timeline graph
- Tests

### Out
- Full Neo4j / LLM summaries
- Adding Robinhood-chain Stockpad (not Meteora)
- Public UI project pages on meteora.fyi (later)
- Scraping the 13 Stocklana submissions (page does not list them)

## Approach
Identity-first, same as pads. ChainRot-style posts are product updates from a **known builder account**. Search cannot replace following those timelines.

Known DBC/stock builders from the operator example + store:
- `@ChainRot_app` — clip → coin, stock quote, Meteora DBC, Stocklana
- `@NousPad` — Hermes project passports on DBC
- `@StockLaunchDBC_` — stock-paired DBC pad (was mis-bucketed `lp_alpha`)
- `@EmojiFunDotXyz` — considering emoji pad on DBC (early)

Search net: `Stocklana` + Meteora/DBC without LP/dex-event.

Graph v0: static seed + derived timeline from mentions JSONL (newest posts per handle). No new volume schema yet.

## Files
| Path | Change |
|------|--------|
| `packages/intel/src/project-graph.ts` | Seeded projects + `projectTimelines()` |
| `packages/intel/src/ecosystem-anchor.ts` | `WATCHED_BUILDER_HANDLES`, `isTrackedProjectAccount`, list-feed union |
| `packages/intel/src/queries.ts` | `stocklana_dbc` query |
| `packages/intel/src/site-data.ts` | Treat tracked projects like pads in `filterFeed` |
| `packages/intel/src/site-server.ts` | `GET /api/projects` |
| `packages/intel/src/buckets.ts` | ChainRot/Stocklana few-shots on `hackathon_builder` |
| tests + `docs/ETHOS.md` | |

## Blast radius
Public ecosystem feed membership (more builder posts). Scanner X cost: +1 query + extra timeline lookups.

## E2E
- [ ] Tests: ChainRot-style handle in list feed; StockLaunchDBC_ not hidden as LP-alpha
- [ ] `/api/projects` returns watched handles
- [ ] typecheck + test suite

## Rollback
Comment out `WATCHED_BUILDER_HANDLES` extras if feed gets noisy.

## Open questions
- [ ] Stocklana showcase of 13 submissions is not public on the hackathon page — more handles will come from search + Vesper replies
- [ ] UI for project timelines on meteora.fyi not in this slice
