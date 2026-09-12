# RWAScreener — Product & Technical Spec

**Codename feel:** Tastefully niche.  
**Repo:** `semi-infiknight/RWAScreener`  
**Checkout:** `/Users/semi/Vibecode/RWAScreener`

## 1. Problem

After Meteora DBC **0.2.1**, quote mints that are not permissionless-supported (notably **xStocks / stock tokens**) can be used on Dynamic Bonding Curve via **token badges**.

We want a screener that tracks **only what that unlock made possible**:

1. **Launches** — DBC pools created **after 0.2.1** whose **quote mint** is in our badged stock-token allowlist.
2. **Launchpads** — entities (configs / fee claimers) that are actually creating those stock-quote pools.

Out of scope for v1: all RWAs, all DBC SOL/USDC launches, sniper UX, wallet tracking, full swap history.

## 2. Domain model (efficient permutation)

```
quote_mints (seed, write-once badges)
    ↓ used as quote
pools (DBC virtual pools after cutoff)
    ↓ belong to
configs (PoolConfig)
    ↓ attributed via fee_claimer / authority
launchpads (label map)
```

Assumptions (product):
- Token badges for our seed set are already created; we do not continuously rediscover badges.
- Any launchpad that integrated DBC can permissionlessly launch against a badged quote.
- xStocks are the primary seed set.

## 3. Hard filters

A pool is **in** the screener iff all of:

| Rule | Value |
| --- | --- |
| Program | DBC `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` |
| Time | `created_at >= DBC_0_2_1_DEPLOY` (2026-09-09 11:00 GMT+8 — confirm exact slot at backfill) |
| Quote | `quote_mint ∈ quote_mints` |
| Badge | quote mint has verified token badge (checked at seed time + optional Checker) |

## 4. Stack (v1)

| Layer | Choice |
| --- | --- |
| Web | Next.js App Router + Tailwind |
| DB | Postgres on Railway |
| Chain | Helius RPC + enhanced webhooks on DBC program |
| Decode | `@meteora-ag/dynamic-bonding-curve-sdk` ≥ 1.5.12 (0.2.1 IDL) |
| Worker | Node/TS in `apps/indexer` — backfill, webhook consumer, checker |
| Host | Railway project **rwascreener** (web + worker + Postgres) |

Skip v1: Geyser, Dune, Bitquery-as-SoT, Redis (add if webhook queue needs it).

### 4.1 Hosting lock (2026-09-12)
- **Project:** `rwascreener` (`7ede8677-ff5f-44cf-911e-fa8bb4100695`)
- **Workspace:** captmathur's Projects
- **Environment:** `production` (`643b2079-4821-412c-beaa-c33524e93705`)
- **Local:** repo linked with `railway link`
- **Services today:** none (empty shell) — provision `web`, `worker`, Postgres in Phase 1
- **Not** the `oracle` Railway project; keep Beyoracle and RWAScreener infra separate

## 5. Services

### 5.1 Seed
- JSON or SQL seed of xStock mints (address, symbol, name)
- Script `verify-badges` derives token badge PDA / fetches account; sets `badge_verified_at`
- Commit seed in repo under `data/quote-mints.json`

### 5.2 Backfill (Sync)
- From cutoff slot/time to now
- Sources (prefer in order): Helius parsed txs for DBC initialize instructions; fallback getSignaturesForAddress + parse
- Keep only pools with quote in seed
- Upsert `configs` + `pools`

### 5.3 Monitor
- Helius webhook → `POST /api/webhooks/helius` (or worker HTTP)
- Fast ACK; enqueue work
- Filter quote mint; upsert

### 5.4 Checker (cron)
- Re-fetch recent pools/configs
- Detect migration / completion flags if exposed
- Re-verify badge accounts for seed mints weekly

### 5.5 API / UI
- `GET /api/launchpads` — group by fee_claimer (count of stock-quote pools, last launch)
- `GET /api/launches` — newest pools; filter by quote mint / launchpad
- `GET /api/quotes` — seed list + usage counts
- Pages: `/` overview, `/launchpads`, `/launchpads/[id]`, `/launches`, `/quotes`

## 6. Schema (Postgres)

```sql
quote_mints (
  mint            text primary key,
  symbol          text not null,
  name            text,
  badge_verified_at timestamptz,
  meta            jsonb default '{}',
  created_at      timestamptz default now()
);

configs (
  address         text primary key,
  quote_mint      text not null references quote_mints(mint),
  fee_claimer     text,
  raw             jsonb,
  first_seen_at   timestamptz not null,
  updated_at      timestamptz default now()
);

pools (
  address         text primary key,
  config          text not null references configs(address),
  base_mint       text not null,
  quote_mint      text not null references quote_mints(mint),
  creator         text,
  activation_at   timestamptz,
  created_at      timestamptz not null,
  status          text default 'curve',
  raw             jsonb,
  indexed_at      timestamptz default now()
);

launchpad_labels (
  fee_claimer     text primary key,
  label           text not null,
  website         text,
  notes           text,
  updated_at      timestamptz default now()
);

ingest_cursor (
  name            text primary key,
  value           text not null,
  updated_at      timestamptz default now()
);

ingest_jobs (
  id              bigserial primary key,
  kind            text not null,
  payload         jsonb not null,
  status          text not null default 'pending',
  attempts        int default 0,
  available_at    timestamptz default now(),
  created_at      timestamptz default now()
);
```

Indexes: `pools(created_at desc)`, `pools(quote_mint, created_at desc)`, `pools(config)`, `configs(fee_claimer)`.

## 7. Env

```
DATABASE_URL=
HELIUS_API_KEY=
HELIUS_WEBHOOK_SECRET=
DBC_PROGRAM_ID=dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
DBC_021_CUTOFF_ISO=2026-09-09T03:00:00.000Z
DBC_021_CUTOFF_SLOT=
```

## 8. Monorepo layout (proposed)

```
RWAScreener/
  apps/web
  apps/indexer
  packages/db
  packages/dbc
  data/quote-mints.json
  docs/
  AGENTS.md
```

## 9. Success criteria (v1)

- Seed ≥ core xStock quotes with badge verification
- Backfill finds real post-cutoff stock-quote DBC pools (or cleanly returns zero if none yet)
- Webhook upserts a matching pool within ~30s of finality
- UI lists launchpads by fee_claimer and launches by time
- SOL/USDC quote pools never appear
- No competitor names in UI copy

## 10. Non-goals (v1)

Sniping, bundled buys, Telegram bots, full OHLCV, wallet PnL, multi-chain.
