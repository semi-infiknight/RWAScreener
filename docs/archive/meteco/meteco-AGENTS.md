# meteco — workspace brain

Meteora ecosystem projects.

- **DBC screener (public):** `RWAScreener` at https://www.meteora.fyi — pad table + ecosystem X feed.
- **`meteora-intel/`** — ingest/classify worker only (no public website). Hourly X search + BGE buckets; JSON API for the screener feed.

## meteora-intel

Local-transformer intel tracker for **Meteora / DBC / launchpad** discourse on X. Finds builders integrating Meteora tech and launchpads exploring/migrating, buckets them semantically. **Public UI is the DBC screener** (https://www.meteora.fyi). This service is API + scanner only.

**API:** https://web-production-a5814.up.railway.app (`/api/feed`, `/api/ingest`, `/health`). `GET /` 301s to meteora.fyi.

### Architecture (fast + semantic, no LLM)

- X API v2 recent search (`src/x-client.ts`, `src/queries.ts`) → `data/mentions.jsonl` (append-only JSONL store, `src/store.ts`). Fetches carry `attachments` media + author avatars (`profile_image_url`).
- Classifier (`src/classifier.ts`): `@xenova/transformers` + `bge-small-en-v1.5` embeddings, cosine similarity to few-shot bucket prototypes (`src/buckets.ts`). Two-stage: (1) signal-vs-noise gate, (2) nearest bucket. **Tune buckets by editing `examples` in `src/buckets.ts`, not keyword lists.** Entry point for pipelines is `classifyPost()` (adds the official-handle override on top of `classifyText`).
- 15 buckets incl. `hackathon_builder` (hackathon/bounty/demo-day teams), `ecosystem_integration` (partnerships), `pad_ecosystem_drama` (third-party drama/movement around the 9 meteora.fyi ecosystem pads: Ember Curve, LFOwn, StonkOptions, Bags, Perpspad, ClawPump, Ethics, RevShare, OTC Desks — queries in the `pad_watch_*` tier, Meteora-free by design since drama rarely mentions Meteora), `memes_meteora_ecosystem` (jokes/shitposts/cultural content about Meteora tech — not suppressed, low lead weight, caught by the `memes_ecosystem` query), and `official_meteora` — the latter is **override-only** (never wins embeddings; assigned via `OFFICIAL_HANDLES` in buckets.ts).
- Site (`src/site-server.ts`, `site-data.ts`, `site-html.ts`): Node HTTP **API** (HTML routes 301 to meteora.fyi). `/api/feed` is what the screener proxies. `site-html.ts` remains for local render tests only.
- **Lanes:** default feed = `ecosystem` (official posts excluded — the monitor finds overlooked ecosystem movement); `?lane=official` shows only MeteoraAG/MeteoraEco. `isOfficial()` matches bucket OR handle (legacy records included). Leaderboard always excludes official accounts.
- **Public feed (meteora.fyi):** live X embeds of ranked post IDs — not a snapshot of stored text/media. Deleted posts fail to embed and are tombstoned after hourly X lookup (`deletedAt`).
- Lead score = bucket BD weight × similarity confidence; `noise_retail_hype` suppressed from feed/leads.
- **Public ecosystem lane** only shows builder/pad/drama buckets (`ECOSYSTEM_FEED_BUCKETS`) and DBC-focused posts (`isDbcLanePost`). Rank: **newest first**. Pad accounts are always eligible (filter, not a rank that buries fresh posts). Hourly list harvest pulls ~7 days of pad timelines so announcements are not missed. Memes, LP-alpha farming, infra bots, and ticker CA/contest templates (`isRetailFeedSpam`) are hidden even if BGE mis-buckets them.
- Admin endpoints (shared-secret `x-ingest-token`): `POST /api/ingest` (raw posts → classify, or `{upsert:true, records}` → trusted replace), `GET /api/export` (full JSONL dump for rehydrate/backup), `POST /api/tombstone` (`{ids}` → mark deleted-on-X so they leave `/api/feed`).

### Commands (from `meteora-intel/`)

```bash
npm test              # tsx --test; classifier/persist/site/seed/ingest suites
npm run typecheck     # tsc --noEmit
npm run probe         # adversarial intelligence battery (24 probes)
npm run scan          # live X recent search + classify (burns X credits)
npm run backfill      # scan --backfill --seed --pages=4 --max=100 --since=2025-01-01
npm run push-scan     # fetch-only scan → POST to $INGEST_URL (what the cron service runs)
npm run rehydrate     # backfill media/avatars onto stored posts (X lookup API)
                      # --remote=<site-url> + INGEST_TOKEN to enrich the live store
npm run reclassify    # re-run current taxonomy over stored posts (no X cost);
                      # --remote pushes changes via upsert. Run after bucket edits.
npm run report / leads
npm run site          # local site on :8787
```

### Monitor loop (live since 2026-09-16)

The site is an **always-on monitor**, not a snapshot:

- **`scanner`** Railway service: cron `0 * * * *` (hourly, top of hour), runs `npx tsx src/push-scan.ts` — fetch-only (no model download). **List feed first:** resolve Vesper + official + screener-pad handles, then `GET /2/users/:id/tweets` + `/mentions` (X Following/List pattern). Then the standing search pool in `src/queries.ts` for unknown builders. LP army is excluded at query + classifier. After ingest it **looks up recent feed IDs** and tombstones posts X no longer returns. All search queries are **language-agnostic** (no `lang:` filter). The classifier (`bge-small-en-v1.5`) is English-only. POSTs raw posts to the site's ingest endpoint. Overlap + server-side id dedup = no double-counting.
- **`web`** service: API only. `POST /api/ingest` (auth: `x-ingest-token` header vs `INGEST_TOKEN` env, timing-safe) classifies via BGE and appends new posts to the store. `GET /` and `/leaderboard` 301 to https://www.meteora.fyi/. Healthcheck `/api/feed`. First ingest after a redeploy re-downloads the model lazily (~1 min, doesn't block healthcheck).
- **Persistence:** Railway volume `web-volume` mounted at `/data` on `web`; `METEORA_INTEL_DATA_DIR=/data`. Mentions survive redeploys; fixture seeding only happens into an empty store.
- Env on scanner: `X_BEARER_TOKEN`, `INGEST_URL`, `INGEST_TOKEN`. Env on web: `INGEST_TOKEN`, `METEORA_INTEL_DATA_DIR`.
- Per-service deploy config lives in Railway service config (NOT railway.toml — toml carries only `[build]` so both services can deploy from this dir): web = `npm start` + healthcheck `/api/feed`; scanner = push-scan + cron + `NEVER` restart.

### Data & seeding

- Server boot: `ensureSeededMentions()` copies a seed into `data/mentions.jsonl` **only when empty**. `seedFixturePath()` prefers `fixtures/seed-mentions.jsonl` (real posts) over `fixtures/demo-mentions.jsonl`; force demo with `METEORA_INTEL_SEED=demo`.
- `fixtures/seed-mentions.jsonl` = **1,421 real classified posts** (backfilled 2026-09-16, fetched 1,824 → classified 1,412 + 9 earlier). Regenerate/refresh with `npm run backfill` then redeploy.
- `data/*.jsonl` is gitignored + railwayignored — Railway always boots from the committed fixture.
- Tests override store location with `METEORA_INTEL_DATA_DIR`.

### Railway deploy

- Project `meteora-intel` (`787deca8-efff-4558-9e99-89e02161e045`), workspace **captmathur's Projects**, region sfo. Linked from `meteora-intel/` dir. Services: **`web`** (`295b7e51-…`, the site) and **`scanner`** (`d365ea7a-…`, hourly cron).
- `railway.toml`: Nixpacks only. Deploy config is per-service (see Monitor loop above). Server binds `PORT` + `0.0.0.0`.
- Ship web: `cd meteora-intel && railway up` → poll `railway deployment list` for SUCCESS → curl `/api/feed` (expect `count` in the hundreds); `GET /` should 301 to meteora.fyi.
- Ship scanner: `railway up -s scanner`. Cron runs are `buildOnly` deploys — no logs until the next hourly tick; check `nextCronRunAt` via API or wait and read `railway logs -s scanner`.
- `.railwayignore` excludes `node_modules`, `.cache`, `data/*.jsonl`, `.env*`. **`fixtures/` uploads** — that's how the seed gets in.
- Dashboard gotcha: an idle cron service shows 0 running replicas — normal, not crashed.

### Secrets

- X keys live in repo-root `.env` (`X_API_KEY`, `X_API_SECRET`, `X_BEARER_TOKEN`), loaded via `src/config.ts` dotenv chain. Never commit; `.env*` is ignored.
- X recent search covers ~7 days; **402 = credits depleted** → CLI prints offline hint, use `--demo`.

### Verify baseline (receipts expected before "done")

```bash
cd meteora-intel
npm run typecheck && npm test   # 8+ tests incl. seed/handler suites
curl -sS https://web-production-a5814.up.railway.app/api/feed | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['count'])"
```

## History & context imports

- **`docs/grok/`** — full Grok CLI session transcripts (exported markdown + `export.py` to re-run). Main session: `meteora-intel-bge-mention-lead-tracker-01a09fd9.md`. Secrets redacted on export.
- **`.grok/plans/meteora-intel.md`** — original plan (buckets, stack).
- **`brand.md`** — brand design deferred; dark editorial feed palette in use. Run `/brand-design` to set up.

## Open threads / next steps

- X API credit budget governs scan cadence (hourly ≈ standing pool × 25 results, all languages; 402 shows up in scanner logs).
- `fixtures/seed-mentions.jsonl` is now redundant with the volume store (volume wins once non-empty); refresh it only as a disaster-recovery snapshot (`npm run backfill` writes it).
- Model cache on web is ephemeral (`.cache/`); could point at `/data` to skip re-download after redeploys.
- Not a git repo yet — no version control or GitHub remote.
