# Plan: nuanced buckets + official lane + media-rich cards

## Goal
Sharpen classification (hackathons etc.), split official Meteora posts into their own lane (monitor = overlooked *ecosystem* movement, official ≠ lead), and render avatar + media images so cards match the solbigweek reference.

## Reference anatomy (solbigweek, scraped)
`<article>` card: round 36px avatar img (`pbs.twimg.com/profile_images`), name 14px medium, `@handle · 10h` mono 11px muted, text, media img `max-h-260px w-full rounded-md border`, hover border accent, focus ring. Keep our palette (brand deferred) + lead badge (our value-add).

## Changes

### Buckets (`src/buckets.ts`)
- Add `hackathon_builder` (lead 0.85): Colosseum/hackathon/bounty/demo-day teams building with Meteora
- Add `ecosystem_integration` (lead 0.5): partnerships/integrations (e.g. Backpack × Meteora)
- Add `official_meteora` (lead 0, not suppressed — own lane). Primarily assigned by handle override
- `OFFICIAL_HANDLES = {meteoraag, meteoraeco}` (extensible)

### Classification (`src/classifier.ts`)
- `classifyPost(input)`: wraps build+classifyText; official handle → primary `official_meteora`, leadScore 0, never noise-gated. Both pipelines call it.

### X fetch (`src/x-client.ts`)
- tweet.fields +`attachments`; expansions +`attachments.media_keys`; media.fields `url,preview_image_url,type`; user.fields +`profile_image_url`
- `SearchedPost.media?: {type, url}[]`; `XUser.profile_image_url`

### Store (`src/store.ts`)
- `MentionRecord.media?: {type,url}[]`, `author.avatarUrl?: string`

### Pipelines
- `src/ingest.ts`: use `classifyPost`, map media/avatar; payload gains `upsert:true` + full-record mode (trusted MentionRecords → `upsertMentions`) for rehydrate
- `src/cli.ts`: use `classifyPost`, map media/avatar

### Views
- `src/site-data.ts`: `isOfficial()` (bucket OR handle — catches legacy records); `filterFeed` gains `lane` (default `ecosystem` = excludes official+noise; `official` = only official); `rankLeaderboard` always excludes official; `windowCounts` lane-aware
- `src/site-server.ts`: parse `?lane=`; `GET /api/export` (token-authed JSONL dump, reuses INGEST_TOKEN)
- `src/site-html.ts`: lane tabs (Ecosystem | Official); cards → round avatar img w/ letter fallback, media images (photo url / video preview), keep badge + lead footer; stats row swaps Stored → Official count

### Rehydrate (`src/rehydrate.ts`)
- Pull full store via `/api/export` (or local data dir), batch `GET /2/tweets?ids=` (100/req) for media + `user.fields=profile_image_url`, merge, POST back `{upsert:true, records}`; locally also refresh `fixtures/seed-mentions.jsonl`

## Verification
- `npm run typecheck && npm test` + new tests: official override, lane filtering, media render, upsert mode
- `npm run probe` (24 adversarial probes still pass with new buckets)
- Local boot: screenshot feed (kitesurf) — avatars + images visible, lanes split
- Deploy web + scanner; run rehydrate against prod; push-scan; live screenshot verify
- Update AGENTS.md (buckets, lanes, endpoints)

## Risks
- New buckets shift classifier geometry → demo/probe expectations could break; fix expectations only if classification is genuinely right
- Upsert endpoint is an authenticated replace path — token-gated, batch-capped
- Rehydrate = ~15 lookup requests (cheap vs search)
- Legacy posts without media render letter-avatar + no image (graceful)

## Out of scope
- Video embeds (poster image only), oEmbed tweet embeds, pagination UI
