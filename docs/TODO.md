# Feed / intel TODO

Captured 2026-09-17 from leftover open threads. Canonical checklist for a cloud or local session. Ethos copy: `docs/ETHOS.md`. Handoff: `docs/CLOUD-RESUME.md`.

Uncheck nothing that is a **standing decision** without the operator saying so.

## Open

- [ ] **Semantic vs scraper** — still allowlist + BGE few-shots, not “understood relevance.”
- [ ] **Unknown builders** — standing search still has to catch DBC people who are not on the pad table.
- [ ] **All languages** — search is language-agnostic; classifier is English, so non-English DBC/pad posts get under-bucketed.
- [ ] **Edited posts** — deletes are tombstoned; edits are not live-updated.
- [ ] **Founder handles** — pads yes; founders only when they exist in `projects.json`. No invented `devX`.
- [ ] **Premium feed chrome** — masonry + native cards are in; a real brand/premium pass is still deferred (`docs/brand.md`).
- [ ] **Memes vs public lane** — culture bucket exists; homepage stays builder/DBC/drama (do not dump shitposts back).
- [ ] **Knowledge graph** — v0 is `GET /api/projects` + harvested timelines, not a graph DB. Stocklana’s 13 submissions still aren’t listed on the hackathon page.
- [x] **Vesper interest leak** — public feed no longer bypasses noise/DBC gates for anyone she `@`’d; harvest is quote/reply only. Interest API can still list mentions. No Following/Likes (app bearer).
- [ ] **X credit budget** — hourly scan; 402 means stop burning search.
- [x] **Ops leftovers** — old meteco folder deleted 2026-09-17; leftover Railway `meteora-intel` (`787deca8`) deletion requested after exporting 2,697 mentions into rwascreener intel. Intel model cache still re-downloads after intel redeploys. GitHub auto-deploy for web is flaky (`railway up -s web`).

## Standing (do not undo)

- [x] **Pad-first ranking** — tried, buried fresh posts. **Keep newest-first.** Do not reintroduce a rank that hides today’s StonkOptions / Ember / ChainRot.
