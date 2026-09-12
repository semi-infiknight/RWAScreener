# RWAScreener

Niche Solana screener for **Meteora DBC** ecosystem tracking (static seed first) and, later, **0.2.1** stock-token quote launches.

## Now (static)

Dashboard of launchpads/builders integrating DBC:

- what they built
- live vs integrating
- what we verified
- contact level with the team

Statuses (`live` / `integrating` / `in_contact` / `discovered`) describe what we know and our relationship. **Not endorsements.**

Seed: [`data/projects.json`](data/projects.json)

```bash
npm install
npm run dev
```

## Later

DBC pools (after 0.2.1) whose quote mint is a badged stock token, grouped by config/fee_claimer.

## Spec kit

| Doc | Purpose |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | Product + schema + services |
| [docs/PATTERNS.md](docs/PATTERNS.md) | Patterns from similar indexers |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased build |
| [AGENTS.md](AGENTS.md) | Contributor invariants |

## Status

Static ecosystem seed + Base-inspired list UI on `main`. Quote-mint seed (61 Backed xStocks) + DBC backfill stub (`packages/dbc`); indexer walk not implemented. Bags `tokens.json` is temporary UI fill — SoT is quote→pool→config.

**Host (for now):** Railway project [`rwascreener`](https://railway.com/project/7ede8677-ff5f-44cf-911e-fa8bb4100695) — empty shell; web, worker, and Postgres go here (not `oracle`).

## Pad live feeds + short-TTL cache

Live pad routes (`/api/pads/<pad>`) stay `force-dynamic`. List fetches in `lib/{ethics,bags,embercurve,clawpump,lfgown,perpspad}.ts` go through [`lib/pad-cache.ts`](lib/pad-cache.ts):

- **Hit:** return cached JSON for `padfeed:<pad>:<fast|full>`
- **Miss:** fetch upstream, `SETEX` (Redis) + memory, return
- **Redis missing/down:** in-memory fallback locally; never invent rows; never hard-fail the route
- **TTL:** `PAD_CACHE_TTL_SECONDS` (default **25s**)

Env (see [`.env.example`](.env.example)): `REDIS_URL` / `REDIS_PRIVATE_URL`, `PAD_CACHE_TTL_SECONDS`, `BAGS_API_KEY`, `HELIUS_API_KEY`.

Local verify (no Redis): `npm run dev` → hit a pad twice within 25s; second response should be fast (memory hit). With Redis: set `REDIS_URL` and confirm keys `padfeed:*`.
