# Meteora Glossary DBC DLMM Launchpad Queries

- Grok session: `01a09fe4-0bbc-7b10-a953-800fdd806fe3`
- cwd: `/Users/semi/Vibecode/meteco`
- model: `grok-4.5`
- raw: `/Users/semi/.grok/sessions/%2FUsers%2Fsemi%2FVibecode%2Fmeteco/01a09fe4-0bbc-7b10-a953-800fdd806fe3/chat_history.jsonl`

---

> [system prompt omitted]


## User

[system-reminder omitted]


## User

GOAL: Produce a concise glossary of Meteora (Solana) product/tech terms and high-signal X search queries for tracking builders, DBC, launchpads, and integration interest.
SCOPE: web knowledge / quick search only; no code writes.
RETURN FORMAT:
- 8-15 product/tech terms (DBC, DLMM, etc.) with 1-line meaning each
- Suggested X recent-search query strings (max 10) focused on builders/tech/launchpads (not retail hype)
- Suggested classification buckets (id + description) for lead-gen toward "launch a launchpad on Meteora"
- Absolute paths: none needed
DONE WHEN: actionable query + bucket list ready for implementers.

> [backend tool call: ?]
> [backend tool call: ?]
> [backend tool call: ?]
> [backend tool call: ?]
> [backend tool call: ?]
> [backend tool call: ?]

## Assistant

I'll pull current Meteora product/tech terminology and builder signals from the web, then return a tight glossary, X queries, and lead-gen buckets.## Meteora glossary (product / tech)

| Term | Meaning |
|------|---------|
| **DBC (Dynamic Bonding Curve)** | Permissionless launch program: virtual pool + customizable curve; graduates to DAMM when quote threshold is hit. Partner configs = launchpad templates. |
| **DLMM (Dynamic Liquidity Market Maker)** | Concentrated liquidity AMM: discrete **price bins**, 0-slippage within a bin, volatility-aware dynamic fees (`lb_clmm`). |
| **DAMM v2** | Configurable constant-product AMM; primary post-graduation / launchpad pool target; Token-2022 position NFTs, anti-sniper fee modes (`cp_amm`). |
| **DAMM v1** | Legacy Dynamic AMM; still migratable for older DBC configs; new DBC configs migrate to DAMM v2 only. |
| **PoolConfig / partner config** | Reusable DBC launch template (quote mint, curve segments, fees, migration target, LP split, claimers) that many creators launch from. |
| **Virtual pool** | Live DBC launch state (reserves, sqrt price, fees, migration progress) before graduation. |
| **Graduation / migration** | Automatic move of curve liquidity into a DAMM pool once migration quote threshold is met (often with locked LP for fee claims). |
| **Bin / bin step** | DLMM price bucket and spacing; active bin holds both assets; trades in-bin have zero slippage. |
| **Fee scheduler / rate limiter** | Anti-sniper base-fee modes (time or mcap decay; size-based fee bumps). Rate limiter deprecated for **new** DBC configs. |
| **Quote-only / collect fee mode** | LP or creator fees taken in quote (e.g. SOL/USDC) rather than base+quote—important for meme/volatile launches. |
| **Alpha Vault** | Pre-activation deposit vault tied to a launch pool; Pro Rata or FCFS allocation before public trading. |
| **Meteora Invent / Fun Launch** | Official tooling + Next.js scaffold to stand up a DBC launchpad UI and onchain actions quickly. |
| **Dynamic Vaults** | Yield layer that rebalances idle liquidity across Solana lending (more LP/infra than launchpad core). |
| **Token-2022 / transfer-hook launches** | Extended token standard support; transfer-hook DBC paths require special config + DAMM v2 migration. |

**Program IDs (signal for onchain filters):** DBC `dbcij3…aqN` · DLMM `LBUZKh…wxo` · DAMM v2 `cpamdp…sGG`

---

## Suggested X recent-search queries (builders / tech / pads)

Use **Latest**; add `since:YYYY-MM-DD` as needed. Prefer builders over ticker spam.

1. `("Dynamic Bonding Curve" OR DBC) (SDK OR CPI OR config OR "pool config" OR partner) (@MeteoraAG OR Meteora) -is:retweet`
2. `(launchpad OR "fun launch" OR Invent OR scaffold) (Meteora OR @MeteoraAG) (DBC OR DAMM) (integrate OR building OR shipped OR docs)`
3. `("DAMM v2" OR DAMMv2 OR cp_amm) (migrate OR graduate OR lock OR "position NFT") (Meteora OR @MeteoraAG)`
4. `(DLMM OR lb_clmm OR "bin step" OR "price bins") (SDK OR CPI OR integrate) (Meteora OR @MeteoraAG)`
5. `("quote mint" OR "Token-2022" OR "transfer hook" OR xStocks OR RWA) (DBC OR "bonding curve") (Meteora OR @MeteoraAG)`
6. `(Believe OR "Jupiter Studio" OR Ember OR PerpsPad OR Bags) (Meteora OR DBC) (launchpad OR curve OR graduate)`
7. `"@meteora-ag/dynamic-bonding-curve" OR "dynamic-bonding-curve-sdk" OR docs.meteora.ag/developer-guides/dbc`
8. `(Alpha Vault OR "fee scheduler" OR "fee claimer" OR "locked LP") (Meteora OR DBC OR DAMM) (launch OR pad)`
9. `(building OR integrating OR "we shipped" OR "built on") (Meteora) (launchpad OR DBC OR DLMM OR DAMM) lang:en -moon -100x`
10. `(@MeteoraAG OR @MeteoraEco) (partner OR config OR launchpad OR Invent OR SDK) filter:replies min_faves:2`

**Optional program-aware watch (onchain → then X):** mentions of `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` + “config” / “launchpad”.

---

## Lead-gen classification buckets  
*(toward “launch a launchpad on Meteora”)*

| id | description |
|----|-------------|
| `pad_live_on_dbc` | Live launchpad already using Meteora DBC (Believe, Jupiter Studio, Ember-class, etc.) — upsell Invent, better configs, fee share, support. |
| `pad_migrating_or_exploring` | Pads on Raydium LaunchLab / pump / Moonit / custom curve asking about migrate, dual-venue, or “graduate to Meteora”. |
| `builder_integrating_sdk` | Devs posting SDK/CPI/docs/`PoolConfig` work — highest intent for partner onboarding. |
| `scaffold_forker` | Shipping Fun Launch / Invent / open-source Meteora launchpad forks — convert to official partner + config key. |
| `vertical_quote_meta` | Pads/builders focused on stock/RWA/Token-2022/perps quote pairs after DBC any-quote unlock — product narrative fit. |
| `token_team_wants_pad` | Single project wanting branded launch UX (not a multi-creator pad) — route to Fun Launch or white-label, not full partner economics. |
| `infra_bot_indexer` | Trading bots, indexers, aggregators on DBC/DAMM/DLMM — partner for distribution, not “run a pad,” but warm intros. |
| `lp_alpha_vault_launch` | Teams designing fair launches with Alpha Vault + DAMM/DLMM (not curve pads) — adjacent product, different pitch. |
| `competitor_pain` | Complaints about snipers, fee routing, graduation UX on other pads — outbound with DBC fee scheduler + locked DAMM v2 story. |
| `noise_retail_hype` | Ticker calls, “100x,” MET price spam — suppress from CRM / do not prioritize. |

**Priority for BD:** `builder_integrating_sdk` → `scaffold_forker` → `pad_migrating_or_exploring` → `vertical_quote_meta` → `pad_live_on_dbc` (expansion).
