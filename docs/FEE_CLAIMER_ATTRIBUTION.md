# Fee claimer attribution

Quote screener SoT remains **quote mint → pool → config / fee_claimer** (`SPEC.md` §2). Labels live in `data/launchpad-labels.json`.

## How to attribute

1. Run `npm run backfill:dbc` (needs `HELIUS_API_KEY`; writes gitignored `data/dbc-backfill-result.json`).
2. `npm run summarize:fee-claimers` — top claimers by stock-quote pool count.
3. Prove a claimer only via pad API / docs / on-chain evidence that ties **the same pool or config** to that pad. Prefer matching `pool` + `config` keys from the pad’s public API against the backfill.
4. Update `launchpad-labels.json` only for proven keys. Leave others unlabeled.

## Proven

| fee_claimer | label | website / X | evidence |
| --- | --- | --- | --- |
| `GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp` | Ember Curve | embercurve.fun / [x](https://x.com/embercurve) | `embercurve.fun/api/solana/markets` pool+config |
| `2gymU5YgYvfxmjTThCvVZV695Mw22Eq4YpZzF1vRJfKc` | Ethics | ethics.ltd / [x](https://x.com/ethicslaunch) | `ethics.ltd/api/launches` mint+poolAddress |
| `4wYGg1KxUroz6Aitgmca64c5wqZW5q1cULCTRJ8dxhyL` | OTC Desks | otcdesks.cash / [x](https://x.com/otc_labs) | `otcdesks.cash/api/coins?q=` mint+meteoraConfig |
| `5x2DYtWmhT4SV2jkpTa561DVdkX8mrUi9y5AxkCCjaxN` | RevShare | revshare.dev / [x](https://x.com/revshare_app) | PartnerMetadata + `bonding_config` mint+config |
| `Fgi5M4W2VzoHWbvcv6RWJRVcJu91frZ18ttGJzMJZu1z` | PURPS | purps.lol / [x](https://x.com/buypurps) | PartnerMetadata name/website |

## 2026-09-14 re-check (unlabeled)

Live staging: 80 claimers. Pad APIs (Ember/Ethics/RevShare/OTC/LFOwn/ClawPump `meteora_dbc`) produced mint+config/pool hits **only** on already-labeled Ember/Ethics/RevShare. PartnerMetadata gPA: no unlabeled staging claimer named. `CuRAzi9uTgkfiXPR8ewbrsMXMVsctmggACi679QoJehx` (13 pools) stays pubkey. ClawPump `meteora_dbc` mint-only overlap on `Fo6sbUoT…` (2/2) — no pad pool/config field, not labeled. Bags `/damm-v2/launches` 429 this pass.

Bags / Perpspad / ClawPump / LFOwn / StonkOptions: still no honest `fee_claimer` mapping for this stock-quote set.
