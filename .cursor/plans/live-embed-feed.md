# Plan: Live X-embed feed + deleted prune

## Goal
meteora.fyi ecosystem feed shows **live posts from X** (edits/deletes match the original). Deleted tweets disappear instead of sitting as a local snapshot.

## Approach
Keep intel JSONL for classification/ranking (id + url + text for BGE). **Render via official X embed** (`widgets.js` / `createTweet`) so the card is the live tweet, not our copy of text/images. Scanner **looks up recent IDs** each hour and tombstones missing ones so they leave the ranked list.

Chosen over “only oEmbed on the server” (extra latency every page) and “delete JSONL on 404 only” (UI would still show ghosts until prune).

## In
- RWAScreener: tweet embeds, hide unavailable, drop stored media/text from cards
- Intel: `deletedAt`, tombstone API, lookup missing IDs, exclude from `/api/feed`
- Scanner: sweep recent feed IDs after push-scan
- Shorter proxy cache so the list feels live

## Out
- Replacing the JSONL store; multilingual model; changing classification

## Blast radius
Feed UX + X tweet-lookup credits (hourly ~100–200 IDs). No payments.

## E2E
- [ ] Deleted ID not in `/api/feed` after tombstone
- [ ] Live card is an X embed; no “Launchpad live” tags; no View More
- [ ] Unavailable embed unmounts (no empty hole)
- [ ] Existing lanes / infinite scroll still work
