# Plan: Pad accounts first, DBC-weighted feed

## Goal
Ecosystem feed is **screener launchpad accounts first**, then **Meteora DBC builder posts** (new pads wanting DBC, Invent/SDK). Recency is within-tier only. Random Meteora name-drops without DBC stay out.

## Approach
Identity + DBC lexical + existing BGE buckets — not a new model.

1. Expand pad handle set with aliases (`embercurvefun`, `launchonsf`).
2. Ecosystem lane: keep if author is a tracked pad **or** text is DBC/Invent/bonding-curve **or** pad-drama naming a tracked pad.
3. Sort: pad handle → DBC builder buckets → timestamp. Use `leadScore` as a tie-break (semantic confidence).

Founder `devX` is empty in `projects.json` — do not invent handles.

## Files
- `ecosystem-anchor.ts`, `buckets.ts`, `site-data.ts`, `queries.ts`, tests
- Deploy intel **web**
