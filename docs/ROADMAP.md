# Roadmap

## Phase 0 — Spec kit
- [x] SPEC + PATTERNS + AGENTS
- [ ] Confirm 0.2.1 exact deploy slot
- [ ] Draft data/quote-mints.json (xStocks)

## Phase 1 — Skeleton
- [x] Railway project `rwascreener` created + linked (empty; env production)
- [ ] Provision Railway: Postgres + `web` + `worker`; Helius/DB env
- [ ] pnpm workspace: web + indexer + db + dbc
- [ ] Drizzle schema + migrations
- [ ] Seed load + badge verify script
- [ ] Empty UI: Launchpads / Launches / Quotes

## Phase 2 — Backfill
- [ ] Cutoff cursor
- [ ] Parse DBC initialize txs; filter quote allowlist
- [ ] Upsert configs + pools
- [ ] Counts-per-quote report

## Phase 3 — Live
- [ ] Helius webhook on DBC program
- [ ] Idempotent consumer
- [ ] Launchpad label map

## Phase 4 — Polish
- [ ] Migration status
- [ ] Optional volume/price enrichment
- [ ] Public read API
