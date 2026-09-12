# Patterns from similar Solana screeners / indexers

Research notes for RWAScreener. Steal architecture, not product scope.
Repos are pattern sources only — do not mirror their UI niche or name them in product copy.

## Sources reviewed (2026-09-12)

| Repo | What to steal |
| --- | --- |
| `nulLeeKH/solana-dex-indexer` | Sync / Consumer / Monitor / Checker split; Postgres-backed work queue; Helius RPC+WS; protocol program IDs as config |
| `bevatsal1122/solana-indexer-*` | Helius webhooks → BullMQ → Postgres; Next.js thin UI over indexed rows |
| `CodeMuscle/solbeam` | Webhook-first (no polling for live); allowlist-driven watches; Next + Supabase Realtime; enrichment APIs later |
| Pump.fun indexers (Rust cluster) | Event taxonomy (create vs trade); Redis buffer in front of Postgres for bursty write; docker-compose for local DB |
| Meteora DBC SDK usage across bots | Decode via `@meteora-ag/dynamic-bonding-curve-sdk` / checked-in IDL — never hand-parse forever |
| Meteora DAMM Data API pattern | Official datapi is great for graduated pool chrome later; not source of truth for DBC badge-quote discovery |

## Patterns that optimize *our* niche

### 1. Allowlist-first, not chain-wide
Solbeam watches wallets; we watch **quote mints**.  
Filter every webhook/backfill hit with `quote_mint ∈ quote_mints`. Drop SOL/USDC/JUP noise immediately.

### 2. Sync ≠ Monitor ≠ Enrich
From solana-dex-indexer:
- **Sync (backfill)** — one-shot / periodic discovery from 0.2.1 cutoff
- **Monitor (webhook)** — real-time initialize-pool (and optional swap later)
- **Consumer** — idempotent upsert into Postgres
- **Checker** — re-fetch config/pool accounts, verify badge still present, mark migrated

Do not put discovery + decode + UI queries in one process.

### 3. Queue between webhook and DB
Helius can burst. Pattern: webhook ACK fast → enqueue job → worker upserts.  
MVP: Postgres `SKIP LOCKED` queue or BullMQ+Redis. Start with Postgres queue to avoid another moving part; add Redis if webhook latency hurts.

### 4. Config is the launchpad join key
DBC pools point at a `PoolConfig`. Partner identity lives on config (`fee_claimer` / config authority).  
**Group pools by config (then by fee_claimer)** — that is how launchpads fall out without scraping frontends.

### 5. Seed tables beat continuous discovery
Token badges are write-once for our purposes. Maintain `quote_mints` as seed data (xStocks + verified badge). Refresh on demand, not every tick.

### 6. Idempotent upserts
Primary keys = pool pubkey, config pubkey, mint pubkey. Webhooks redeliver; backfill overlaps monitor. Always `ON CONFLICT DO UPDATE`.

### 7. Cutoff as a hard product rule
Store `DBC_021_DEPLOY_AT` (slot + timestamp). Reject rows before cutoff in ingest and in API. Niche purity is a filter, not a vibe.

### 8. Enrichment is phase 2
Price/volume/OHLCV from Jupiter / DexScreener / Meteora datapi after the directory works. Indexers that bolt charts on day one ship late and miss the discovery core.

### 9. Thin Next.js over fat DB
UI reads Postgres (or Supabase Realtime). No per-page RPC for the main lists.

### 10. Label map is data, not code
`fee_claimer → launchpad_label` in DB/JSON. Unknown claimers show truncated pubkey until labeled.

## Anti-patterns to avoid

- Indexing all DBC swaps on day one
- Scraping launchpad websites as source of truth
- GPA-spamming mainnet without mint filters
- Coupling UI deploy to indexer deploy (split services)
- Naming or featuring other launch products in the UI
