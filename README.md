# RWAScreener

Niche Solana screener for **Meteora DBC 0.2.1** stock-token quote launches.

- DBC pools (after the upgrade) whose quote mint is a badged stock token
- Launchpads/configs creating those pools

Not a general RWA dashboard. Not a SOL/USDC launch feed.

## Spec kit

| Doc | Purpose |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | Product + schema + services |
| [docs/PATTERNS.md](docs/PATTERNS.md) | Patterns from similar indexers |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased build |
| [AGENTS.md](AGENTS.md) | Contributor invariants |

## Status

Spec kit on `main`. App scaffold not started.

**Host (for now):** Railway project [`rwascreener`](https://railway.com/project/7ede8677-ff5f-44cf-911e-fa8bb4100695) — empty shell; web, worker, and Postgres go here (not `oracle`).
