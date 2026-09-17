# Roadmap

Operator intent for the public feed/monitor (including not-yet-done asks) lives in **docs/ETHOS.md**. Do not drop those prompts when picking up a ticket.

## Phase 0 — Spec kit + static ecosystem
- [x] SPEC + PATTERNS + AGENTS
- [x] Static ecosystem seed (`data/projects.json`) + Next.js dashboard
- [ ] Owner fill: contact levels, LFGOWN identity, missing X handles
- [ ] Confirm 0.2.1 exact deploy slot
- [x] Draft data/quote-mints.json (xStocks) — 61 Backed seed

## Phase 1 — Skeleton
- [x] Railway project `rwascreener` created + linked (empty; env production)
- [ ] Provision Railway: Postgres + `web` + `worker`; Helius/DB env
- [ ] pnpm workspace: web + indexer + db + dbc
- [x] SQL schema stub (`packages/db/migrations/001_init.sql`)
- [ ] Drizzle schema + migrations
- [ ] Seed load + badge verify script
- [ ] Empty UI: Launchpads / Launches / Quotes

## Phase 2 — Backfill
- [x] Backfill stub (`packages/dbc` + `apps/indexer`; fail closed without Helius)
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
