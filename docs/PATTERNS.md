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

## Official provider patterns (2026-09-12)

Sources: Helius Data Streaming + LaserStream docs; QuickNode Streams docs/guides; Triton One Dragon's Mouth / Yellowstone gRPC docs (`rpcpool/yellowstone-grpc`).

### Helius

| Product | Official stance | Fit for RWAScreener |
| --- | --- | --- |
| **Webhooks** | HTTP POST, parsed events, retries, no historical replay | **MVP Monitor** — low ops, ACK fast, dedupe deliveries |
| **LaserStream gRPC** | Yellowstone-compatible; auto-reconnect; **~24h `fromSlot` replay**; multi-node; filter hard | **Production Monitor** once volume or missed webhooks hurt |
| **LaserStream WS** | UI / moderate backends | Not our primary indexer path |
| **Shreds / preconfirmations** | Sub-ms trading | **Out of scope** (sniper stack, not a directory screener) |

Official guidance we should copy:
1. Prefer **narrow filters** (`accountInclude` / program / `vote:false` `failed:false`) — JS clients lag on fat streams.
2. Persist **last processed slot**; resume with `fromSlot` on reconnect (within ~24h window).
3. Use **confirmed/finalized** for directory truth; `processed` can fork without rollback notices.
4. Order with **block/transaction index**; treat slot notifications as “flush this slot.”
5. Webhooks: **dedupe** (retries can double-deliver); no replay → backfill gap separately.
6. Account/program state changes need LaserStream/Geyser — shreds do **not** carry account updates.

### QuickNode Streams

Official model: **filter at the edge → push to destination** (Webhook, **Postgres**, S3, Kafka).

Patterns to steal:
1. **Server-side JS/Go filters** — only emit DBC txs that mention our quote mints / program; return `null` when no match (bill for less noise).
2. **Same Stream for backfill + live** — set block range for history, then continuous; avoids hand-rolled signature walks for MVP history.
3. Destination = **Postgres** with `ON CONFLICT DO NOTHING` on signature (their Solana backfill guide).
4. Validate webhook authenticity (security token / custom headers).
5. Reorg handling is productized — still keep idempotent upserts.

Fit: strong **alternative to DIY backfill** if we want provider-managed filter+Postgres. Still decode DBC with our SDK after delivery.

### Triton One — Dragon's Mouth (Yellowstone gRPC)

Official stance: gRPC/Geyser for **backend** indexers (not browsers). `@triton-one/yellowstone-grpc`.

Patterns to steal:
1. Subscribe to **transactions** with `account_include` = DBC program (and/or quote mints); `vote:false`, `failed:false`.
2. Optional **accounts** owner = DBC for pool/config account writes (Checker enrichment).
3. **`from_slot` + `SubscribeReplayInfo`** for short disconnect recovery (server buffer only — not deep history).
4. Deduplicate when replaying from last slot.
5. Commitment: default processed; for DB commits prefer buffering until **confirmed/finalized** slot notification (release buffer on slot status).
6. Pings to keep streams alive behind proxies.
7. Compressed account filters if tracking huge mint sets later (cuckoo filter + client-side exact contains).
8. Deshred stream = latency trading only — **not** for screener SoT (no execution meta / finality).

Fit: interchangeable with Helius LaserStream (wire-compatible Yellowstone). Choose on plan/latency, not architecture.

### Provider-shaped recommendation for us

```
Phase A (now):  Helius enhanced webhook on DBC program
                → filter quote_mint ∈ seed in our worker
                → idempotent Postgres upsert
                + one-shot RPC/Helius backfill from 0.2.1 cutoff

Phase B:        Same filters on LaserStream gRPC OR Triton Dragon's Mouth
                → persist slot cursor, fromSlot resume
                → confirmed/finalized for inserts

Optional alt:   QuickNode Stream with server-side filter
                → webhook or direct Postgres
                → still run DBC SDK normalize step
```

Do **not** build on shreds/preconfirmations for this product.

## Anti-patterns to avoid

- Indexing all DBC swaps on day one
- Scraping launchpad websites as source of truth
- GPA-spamming mainnet without mint filters
- Coupling UI deploy to indexer deploy (split services)
- Naming or featuring other launch products in the UI
