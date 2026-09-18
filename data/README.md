# Static seed

`projects.json` is the source of truth for the DBC ecosystem dashboard until on-chain indexing lands.

## Status labels

| Status | Meaning |
| --- | --- |
| `live` | Public product with DBC (or partner) integration we can point at |
| `integrating` | Building / shipping DBC path; not fully verified live |
| `in_contact` | We are talking with the team (relationship signal) |
| `discovered` | Found or listed; thin public proof so far |

Labels describe **what we know** and **our relationship**. They are **not** endorsements.

## Editing

1. Edit `projects.json`.
2. Keep `id` stable (kebab-case).
3. Prefer adding `sources` URLs over prose-only claims.
4. Leave `contact` as `unknown` until a human sets it.


## Tokens (`tokens.json`)

Per-launchpad screener rows. Shape is defined in `lib/tokens.ts`.

- **Bags** rows are refreshed from the Bags public API (real mints). Metrics stay `null` until a pricing source is wired — never invent numbers.
- **StonkOptions** (`launchpadId: stardotfun`) live feed: `indexer.canary.stonkoptions.xyz/v2/catalog`.
- Other launchpads may still be draft frontend seeds.

### Refresh Bags tokens

```bash
# Optional — send x-api-key when you have one (feed/pools currently work without it)
export BAGS_API_KEY=your_key
# or add BAGS_API_KEY=... to .env / .env.local (gitignored)

node scripts/refresh-bags-tokens.mjs
```

Program IDs (docs.bags.fm/principles/program-ids): DBC `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`, DAMM v2 `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`, Fee Share V2 `FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK`.


## Quote mints (`quote-mints.json`) — screener SoT step 1

Source of truth for the **quote screener** is **quote → pool → config**, not the Bags feed.

- 61 Backed xStocks. Mints from mint authority `S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS`; names from `xstocks-metadata.backed.fi`.
- Fields: `mint`, `symbol`, `name`, `badge_verified_at` (null until Checker), `meta`.
- Do not invent mint addresses. Do not expand this list from Bags / other pad APIs.
- `tokens.json` Bags rows stay as **temporary UI fill** for the ecosystem dashboard. StonkOptions (`stardotfun`) is live from the pad indexer, not `tokens.json`.

## Platform tokens (`platform-tokens.json`)

Optional homepage **Token** column: each launchpad’s own token + Jupiter mcap.

- Only Jupiter-verified mints with a matching pad website.
- Never invent a mint. Bags / Revshare stay blank until an official CA is verified.
- STAR on Stonk Options is the Star.fun ecosystem token (buybacks), not a pad-issued token.

## Launchpad labels (`launchpad-labels.json`)

`fee_claimer → label` map. Only proven pad mappings (pad API / docs / on-chain pool+config overlap). Unknown claimers stay as pubkey — do not invent Bags / Perpspad / other pubkeys.

Observed (2026-09-12, from Helius stock-quote backfill):
- `GZjYfGyUNQfDChcQ66Gc3ZMcQqPEisyRYe1nPyQhP9bp` → Ember Curve (`embercurve.fun/api/solana/markets`)
- `2gymU5YgYvfxmjTThCvVZV695Mw22Eq4YpZzF1vRJfKc` → Ethics (`ethics.ltd/api/launches`)

Aggregate locally: `npm run summarize:fee-claimers` (optional `--json` → gitignored `data/fee-claimer-attribution.json`).

