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
- **StonkOptions / star.fun** (`launchpadId: stardotfun`) stays empty while `screenerLive: false`.
- Other launchpads may still be draft frontend seeds.

### Refresh Bags tokens

```bash
# Optional — send x-api-key when you have one (feed/pools currently work without it)
export BAGS_API_KEY=your_key
# or add BAGS_API_KEY=... to .env / .env.local (gitignored)

node scripts/refresh-bags-tokens.mjs
```

Program IDs (docs.bags.fm/principles/program-ids): DBC `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`, DAMM v2 `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`, Fee Share V2 `FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK`.
