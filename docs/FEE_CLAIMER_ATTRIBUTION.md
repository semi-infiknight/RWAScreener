# Fee claimer attribution

Quote screener SoT remains **quote mint → pool → config / fee_claimer** (`SPEC.md` §2). Labels live in `data/launchpad-labels.json`.

## How to attribute

1. Run `npm run backfill:dbc` (needs `HELIUS_API_KEY`; writes gitignored `data/dbc-backfill-result.json`).
2. `npm run summarize:fee-claimers` — top claimers by stock-quote pool count.
3. Prove a claimer only via pad API / docs / on-chain evidence that ties **the same pool or config** to that pad. Prefer matching `pool` + `config` keys from the pad’s public API against the backfill.
4. Update `launchpad-labels.json` only for proven keys. Leave others unlabeled.

## Proven (2026-09-12)

| fee_claimer | label | evidence |
| --- | --- | --- |
| `GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp` | Ember Curve | `embercurve.fun/api/solana/markets` — 285/288 stock-quote pools |
| `2gymU5YgYvfxmjTThCvVZV695Mw22Eq4YpZzF1vRJfKc` | Ethics | `ethics.ltd/api/launches` — 3/3 DBC stock-quote pools |

Bags / Perpspad / ClawPump / LFOwn / StonkOptions: no honest fee_claimer mapping yet for this stock-quote set.
