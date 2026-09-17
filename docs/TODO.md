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
- [ ] **Vesper interest depth** — v0 is mentions/replies/quotes only. No Following/Likes (app bearer). Personal @s (`semiii`, `playmatejaylene`) currently sit in the interest list next to pads.
- [ ] **X credit budget** — hourly scan; 402 means stop burning search.
- [ ] **Ops leftovers** — old meteco / meteora-intel Railway can still be deleted by the operator; intel model cache still re-downloads after web/intel redeploys; GitHub did not auto-deploy web (last ship was `railway up -s web`).

## Standing (do not undo)

- [x] **Pad-first ranking** — tried, buried fresh posts. **Keep newest-first.** Do not reintroduce a rank that hides today’s StonkOptions / Ember / ChainRot.
