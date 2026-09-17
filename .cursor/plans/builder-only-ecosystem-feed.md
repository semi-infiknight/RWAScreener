# Plan: Ecosystem feed = builders / pads / drama only

## Goal
Public ecosystem feed stops showing ticker CA calls, LP farming, trading contests, and AI-signal bots. It shows **DBC/launchpad builders, live pads, pad drama, and real Meteora-track hackathon builds**.

## Approach
Do not retune BGE for this. Recency + leaky buckets is the bug.

1. **Allowlist** ecosystem-lane buckets (hide memes, infra/bots, LP-alpha, single-ticker pad-want).
2. **Hard spam** (`isRetailFeedSpam`): CA + AI Signal + trading contest + prize-pool name-drops + LP army/`met_lparmy` + LP-bot yield.
3. Comment out the **memes** search query so we stop ingesting shitposts.

## Files
- `src/buckets.ts` — `ECOSYSTEM_FEED_BUCKETS`
- `src/ecosystem-anchor.ts` — spam rules
- `src/site-data.ts` — apply on ecosystem lane
- `src/classifier.ts` — force noise
- `src/queries.ts` — comment memes query
- tests + deploy **intel web** (filter is API-side)

## Out
- Official lane unchanged
- List-feed harvest unchanged
