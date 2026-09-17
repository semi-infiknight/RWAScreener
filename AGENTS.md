# AGENTS.md — RWAScreener

## Mission
1. **Ecosystem (now):** static-seeded dashboard of DBC-integrating launchpads/builders — what they built, live vs integrating, verified facts, contact level. Status labels are not endorsements.
2. **Quote screener (later):** niche tracker for Meteora DBC 0.2.1 stock-as-quote launches — seed badged quote mints → DBC pools after cutoff → group by config/fee_claimer → label launchpads.

## Read first
- **docs/CLOUD-RESUME.md** — handoff for a new session (live topology + what’s already shipped)
- **docs/ETHOS.md** — operator intent for the ecosystem monitor/feed (keep even if unimplemented)
- docs/SPEC.md
- docs/PATTERNS.md
- docs/ROADMAP.md

## Source of truth (quote screener)
**quote mint → pool → config / fee_claimer** (`docs/SPEC.md` §2).

- Allowlist: `data/quote-mints.json` (Backed xStocks; badge_verified_at null until Checker).
- Discover pools on DBC after `DBC_021_CUTOFF_ISO`, keep only `quote_mint ∈ seed`.
- Attribute launchpads from `PoolConfig.fee_claimer` + `data/launchpad-labels.json`.
- **Not SoT:** Bags `tokens.json` / Bags feed. That file is temporary UI fill for the ecosystem dashboard. Do not add another pad scraper or treat Bags as the quote-screener directory.

## Invariants
0. Ecosystem statuses describe knowledge/relationship only — never frame as endorsements.
1. Never list pools whose quote mint is outside quote_mints seed.
2. Never list pools before DBC_021_CUTOFF.
3. Prefer on-chain proof over website scraping.
4. Do not name or promote competitor products in UI copy.
5. Idempotent upserts only.
6. Never invent mint addresses or fee_claimer pubkeys. Omit if unverified.
7. Indexer stubs fail closed (empty result) when HELIUS_API_KEY is missing — no fake pools.

## Stack
Next.js + Postgres + Helius webhooks + @meteora-ag/dynamic-bonding-curve-sdk worker.

Lightweight stubs (no full monorepo rewrite yet): `packages/dbc`, `packages/db`, `packages/intel`, `apps/indexer`, `scripts/dbc-backfill.mjs`.

## Intel (ecosystem X feed)

API + hourly X scanner live in **`packages/intel`**. Public UI is this Next.js app (`/api/ecosystem-feed` proxies `METEORA_INTEL_URL`). Project timelines: intel `GET /api/projects`. Vesper interest: `GET /api/vesper-interest`. Operator intent: **`docs/ETHOS.md`**.

Railway project **`rwascreener`**, services:

- **`intel`** — `npm start`, volume `/data` (`METEORA_INTEL_DATA_DIR=/data`), healthcheck `/health`. Private URL for web/scanner.
- **`scanner`** — `INTEL_ROLE=scanner`, cron `0 * * * *`, restart `NEVER`. `INGEST_URL` → intel private domain.
- **`web`** — `METEORA_INTEL_URL=http://${{intel.RAILWAY_PRIVATE_DOMAIN}}:8080` (`${{intel.PORT}}` interpolates empty)

Commands (from `packages/intel/`): `npm test`, `npm run typecheck`, `npm run site` (local :8787).

Do not run the old `meteora-intel` Railway project (`787deca8-…`) after cutover.

## Deploy
Railway project **`rwascreener`** (`7ede8677-ff5f-44cf-911e-fa8bb4100695`, env `production`).
Web + worker + Postgres + intel + scanner land here. Do **not** deploy into `oracle`.
Do **not** provision Railway from stubs.
