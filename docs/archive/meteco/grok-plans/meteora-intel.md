# Meteora Intel — mention tracking subproject

## Goal
Track X (Twitter) discourse about Meteora / DBC / related tech, classify posts into builder- and launchpad-oriented buckets using a **local free transformer** (MiniLM embeddings), and surface **leads** for converting builders into Meteora launchpad partners.

## Stack
- TypeScript CLI under `meteora-intel/`
- X API v2 recent search (`X_BEARER_TOKEN` from repo root `.env`)
- Local classifier: `@xenova/transformers` + `Xenova/bge-small-en-v1.5` (embedding similarity to bucket prototypes — no paid LLM, no Ollama required)

## Buckets (priority for BD)
1. `builder_integrating_sdk`
2. `scaffold_forker`
3. `pad_migrating_or_exploring`
4. `vertical_quote_meta`
5. `pad_live_on_dbc`
6. `token_team_wants_pad`
7. `infra_bot_indexer`
8. `lp_alpha_vault_launch`
9. `competitor_pain`
10. `noise_retail_hype` (suppress)

## CLI
- `npm run scan` — fetch + classify + append JSONL
- `npm run report` — bucket summary + top leads
