# meteora-intel

Local, builder-focused intel tracker for **Meteora**, **DBC (Dynamic Bonding Curve)**, related launch tech, and **launchpad leads**.

It pulls recent X posts, then classifies them with a **free local sentence transformer** (`bge-small-en-v1.5` via `@xenova/transformers`) — cosine to bucket prototypes, not keyword rules and not an LLM “read then think” pass.

## Why

Find people and teams who are:

- building with / integrating Meteora DBC
- shipping Fun Launch / Invent scaffolds
- running or exploring launchpads on (or toward) Meteora
- asking for help / partnership
- complaining about competitor launch UX (outbound signals)

…and bucket them so BD can convert high-intent builders into **launchpads on Meteora**.

## Buckets

| id | intent |
|----|--------|
| `builder_integrating_sdk` | SDK / CPI / PoolConfig work |
| `scaffold_forker` | Fun Launch / Invent forks |
| `pad_migrating_or_exploring` | Pads exploring or migrating to DBC |
| `vertical_quote_meta` | Token-2022 / RWA / custom quote verticals |
| `pad_live_on_dbc` | Already live on DBC |
| `token_team_wants_pad` | Single project wants branded launch UX |
| `infra_bot_indexer` | Bots / indexers / analytics |
| `lp_alpha_vault_launch` | Alpha Vault / fair-launch LP design |
| `competitor_pain` | Pain on other pads → outbound |
| `noise_retail_hype` | Price spam — suppressed from leads |

## Setup

From repo root, keys already live in `../.env`:

```bash
X_API_KEY=...
X_API_SECRET=...
X_BEARER_TOKEN=...
```

Install:

```bash
cd meteora-intel
npm install
```

First classify run downloads BGE-small into `.cache/transformers/` (~33M params, 384-d).

## Commands

```bash
# Automated tests (real MiniLM classifier + persist/leads)
npm test
npm run probe          # adversarial intelligence battery

# Synthetic posts — proves local classifier without burning X quota
npm run classify-demo
npm run scan -- --demo
npm run scan -- --demo --force   # rewrite demo-* rows

# Live X recent search + classify (needs bearer token + search credits)
npm run scan
npm run scan -- --max=20 --query=dbc_sdk

# Summaries
npm run report
npm run leads

# API only (HTML is gone — public feed is https://www.meteora.fyi/)
npm run scan -- --demo --force
npm run site
# http://127.0.0.1:8787/api/feed  /health  /api/ingest

# Push scan (what the hourly Railway cron `scanner` service runs;
# fetch-only, POSTs to /api/ingest — classification happens server-side)
INGEST_URL=... INGEST_TOKEN=... npm run push-scan

Public feed: https://www.meteora.fyi/
API (not a site): https://web-production-a5814.up.railway.app/api/feed
```

## Monitor mode

In production a second Railway service (`scanner`) runs `push-scan` hourly (`0 * * * *`) and pushes new posts to `POST /api/ingest` on the API service, which classifies + stores them on a persistent volume (`/data`). The DBC screener on meteora.fyi proxies `/api/feed`. See `../AGENTS.md` for the full topology.

Data is appended to `data/mentions.jsonl` (gitignored). Override with `METEORA_INTEL_DATA_DIR`.

If live search returns **402 credits depleted** (or 401/403), the CLI prints an offline hint; use `--demo` until X credits are restored.

## Notes

- Recent search covers ~7 days and depends on your X API access tier.
- Classification is two-stage geometry: (1) builder/pad **signal vs noise** gate, (2) nearest few-shot bucket. Tune `examples` in `src/buckets.ts` — including shill-with-tech-words on the noise bucket. Not keyword lists, not an LLM.
- Lead score = bucket BD weight × similarity confidence (noise suppressed).
