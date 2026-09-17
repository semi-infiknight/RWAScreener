# Plan: X list-timeline harvest (backend)

## Goal
Scanner follows the **X Following/List pattern**: seed accounts (Vesper, official, screener pads) → user timelines + mentions → merge by id with search discovery. Not keyword-only, not tweet iframes.

## In
- Resolve handles → ids once per scan
- `GET /2/users/:id/tweets` and `GET /2/users/:id/mentions` (exclude retweets)
- Merge into push-scan before ingest

## Out
- Home timeline (needs user OAuth)
- Frontend embed changes
