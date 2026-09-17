# Cloud agent resume (2026-09-17)

This repo **`semi-infiknight/RWAScreener` `main`** is the source of truth. The old local folder `~/Vibecode/meteco` is **not a git repo** and is not on GitHub — do not resume work there.

Public product: **https://www.meteora.fyi** (DBC screener + ecosystem feed). Intel is API + hourly scanner only.

## Read in order

1. `docs/TODO.md` — open feed/intel checklist
2. `docs/ETHOS.md` — operator intent, including still-open asks
3. `AGENTS.md` — topology and Railway IDs
4. `.cursor/rules/ethos.mdc` — always-on product rules
5. `.cursor/plans/` — how we got here (especially `vesper-interest-graph.md`, `stocklana-builders-project-graph.md`, `merge-intel-into-rwascreener.md`, `pad-first-dbc-feed.md`)
6. `docs/brand.md` — brand pass **deferred**
7. `docs/GROK-ORIGIN.md` — compressed Grok CLI origin (not the 30k-line transcripts)
8. `docs/archive/meteco/` — Cursor + Grok raw archive (redacted). Full unredacted local copy: `archive/meteco-private/` (gitignored).

## Live Railway (`rwascreener`, `7ede8677-ff5f-44cf-911e-fa8bb4100695`, env `production`)

| Service | Role |
|---|---|
| `web` | Next.js meteora.fyi |
| `intel` | BGE classify + JSONL on volume `/data` — public API `https://intel-production-65e2.up.railway.app` |
| `scanner` | cron `0 * * * *`, `INTEL_ROLE=scanner`, restart NEVER |
| worker / Postgres / Redis | quote screener / staging, not the X feed |

Web → intel: `METEORA_INTEL_URL=http://${{intel.RAILWAY_PRIVATE_DOMAIN}}:8080` (`${{intel.PORT}}` interpolates **empty**).

Do **not** deploy into Railway project `oracle`. Do **not** revive old `meteora-intel` project `787deca8-…`. Operator may delete that leftover.

GitHub → web auto-deploy has been flaky; if a push does not appear on meteora.fyi, `railway up -s web -y -c`. Intel/scanner: `railway up -s intel|scanner --path-as-root packages/intel`.

## What’s already on main (feed)

- Native masonry cards (not Tweet.html iframes). Unused iframe helpers: `lib/x-widgets.ts`.
- Newest-first ecosystem lane; pad-first ranking **reverted**.
- Screener-style heading lockup (no logo, no header animation).
- List harvest (Vesper, official, screener pads + watched builders).
- Project graph v0: `GET /api/projects`.
- Vesper interest v0: read her mentions/replies/quotes → `GET /api/vesper-interest` → harvest + feed bypass. No Following/Likes APIs.
- Stocklana watch: ChainRot, NousPad, StockLaunchDBC_, EmojiFun.

## Secrets (never commit)

Scanner/intel need `X_BEARER_TOKEN` (+ `X_API_KEY` / `X_API_SECRET`) and `INGEST_TOKEN` on Railway. Those X keys are set on **intel** and **scanner**. Local copy is gitignored `.env`. Do not paste them into git or chat.

## Still open

See **Still open** in `docs/ETHOS.md` (semantic vs scraper, unknown builders, languages, edits, founders, premium chrome, memes lane, knowledge graph depth, Vesper Following, X credits). Operator wanted leftover meteco Railway deleted by them, not by the agent.
