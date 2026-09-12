# `@rwascreener/dbc` stub

Lightweight DBC helpers for the current Next.js repo (no workspace rewrite).

- Program: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
- Cutoff: `DBC_021_CUTOFF_ISO=2026-09-09T03:00:00.000Z`
- Allowlist: `data/quote-mints.json` (SoT step 1: quote mint)
- `backfillOnce()` — fail closed when `HELIUS_API_KEY` is missing; never invents pools

SoT: **quote mint → pool → config/fee_claimer**. Bags `tokens.json` is temporary UI fill, not this path.
