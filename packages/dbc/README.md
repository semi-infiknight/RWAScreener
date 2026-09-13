# `@rwascreener/dbc`

DBC helpers for the quote-mint screener path (SPEC §5.2).

- Program: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
- Cutoff: `DBC_021_CUTOFF_ISO=2026-09-09T03:00:00.000Z` (optional `DBC_021_CUTOFF_SLOT`)
- Allowlist: `data/quote-mints.json` (SoT step 1: quote mint)
- `backfillOnce()` — Helius initialize-tx walk; **fail closed** (`ok:false`, exit 1) when `HELIUS_API_KEY` is missing; never invents pools
- Optional `DATABASE_URL` — idempotent upsert into `quote_mints` / `configs` / `pools` (skip cleanly if unset). Does **not** invent `launchpad_labels`

## Walk

1. `getProgramAccounts` PoolConfig with `memcmp` on `quote_mint ∈` seed
2. `getProgramAccounts` VirtualPool / TransferHookPool by config
3. `getSignaturesForAddress(pool)` → oldest `getTransaction` → parse `InitializeVirtualPool*`
4. Keep only allowlisted quote + `created_at ≥` cutoff

Writes/refreshes `data/dbc-backfill-result.json` (gitignored) when key is present.

```bash
npm run backfill:dbc
```

SoT: **quote mint → pool → config/fee_claimer**. Bags `tokens.json` is temporary UI fill, not this path.
