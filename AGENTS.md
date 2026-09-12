# AGENTS.md — RWAScreener

## Mission
Niche screener for Meteora DBC 0.2.1 stock-as-quote launches only.
Seed badged quote mints → DBC pools after cutoff → group by config/fee_claimer → label launchpads.

## Read first
- docs/SPEC.md
- docs/PATTERNS.md
- docs/ROADMAP.md

## Invariants
1. Never list pools whose quote mint is outside quote_mints seed.
2. Never list pools before DBC_021_CUTOFF.
3. Prefer on-chain proof over website scraping.
4. Do not name or promote competitor products in UI copy.
5. Idempotent upserts only.

## Stack
Next.js + Postgres + Helius webhooks + @meteora-ag/dynamic-bonding-curve-sdk worker.
