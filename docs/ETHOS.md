# Ethos — Meteora ecosystem monitor

Captured from operator prompts (2026-09-16–17). This is **product intent**, not a changelog. If code lags the prompt, **keep the prompt**. Do not wait to be told again.

Public surface: **https://www.meteora.fyi** (DBC screener + feed). Intel is API + hourly scanner only (`packages/intel`). There is no separate intel website.

---

## North star

This product is a **live monitor and a second brain** for the Meteora ecosystem: not a snapshot, not a keyword scraper with a UI.

> “ingest and find tweets all the time and classify semanticise them… basically the ethos of this project, a monitor”

> “meteora intel should be able to maintain a context timeline/graph about project twitter, what are they currently doing… more than a monitor its a knowledge graph and a second brain”

> “the point of semantic search is that u understand how relevant it is to meteora ecosystem otherwise what is the different between this intel backend and just a pattern based scraper”

The public feed is one view. Behind it, intel keeps **per-project timelines** (what ChainRot / NousPad / StockLaunch / screener pads are shipping). If a change makes the feed look like ticker scraping, LP yield, or contest spam, it is wrong even if BGE labeled it.

---

## Always

- **Track project accounts, not just keywords.** Screener pads plus DBC/stock/hackathon builders (ChainRot-class). Harvest their timelines. Builder-update posts are the gold (e.g. https://x.com/ChainRot_app/status/2100400368408809973).
- **Official Meteora is a separate lane.** Ecosystem movement that could be overlooked is the default feed. Official posts are part of the ecosystem but **must not mix** into that lane or the leaderboard.
- **Hackathons only when the Meteora track / DBC build is real** — not generic demo-day spam.
- **Follow the Vesper footprint by reading her interactions, not just indexing her tweets.** `@vesper792` posts, replies, quotes, and @-mentions are the live prior for who to harvest next. Example: https://x.com/vesper792/status/2100474095473455266 — treat who she is talking about / quoting as current interest. Do not turn that into a rank that buries today’s pad announcements.
- **All languages in search.** Language-agnostic harvest; do not `lang:en`-filter the X queries.
- **Newest relevant posts first.** A tracked pad announcing today beats a “more pad-like” post from last week. Recency is the public rank (pad-first ranking buried fresh announcements — do not bring that back).
- **Deleted on X → gone here.** Tombstone after lookup. The feed is live, not a static archive of stored text.
- **One product:** intel lives in the RWAScreener repo + rwascreener Railway. Do not recreate a meteco / meteora-intel Railway site.

## Never

- LP / LP army / yield-farm / `met_lparmy` content in the public ecosystem feed.
- Ticker CA calls, dex-events / KOL-signal bots, trading contests, prize-pool name-drops, pump.fun mcap templates.
- Competitor-pain and unrelated ecosystem (e.g. Arc) as if they were Meteora DBC.
- Bucket tags, lead scores, or **total post counts** on the public UI (internal only).
- Time-window filters on the public feed (keep it simple until asked).
- “View more” as the way to see the rest of the feed — **infinite scroll**.
- Tweet.html / widgets.js iframes as the default card (they made a one-column laggy feed). Native cards; backend harvest can still follow X list/timeline patterns.
- Mixing official MeteoraAG/MeteoraEco into the default ecosystem lane.
- Treating stored JSONL as source of truth for “still on X.”

---

## Discovery (how we find posts)

X does not “know” our semantics. We **aim** search + list harvest, then BGE buckets.

1. **List / Following-style harvest first** — Vesper, official, every screener pad handle (and aliases). Pad timelines look back ~7 days so announcements are not missed between hourly crons. Mentions window can stay short (overlap).
2. **Standing search pool** for unknown builders (DBC, Invent, hackathon track, pad names). Language-agnostic.
3. **Classifier** (`bge-small-en-v1.5`) is English-only embeddings — tune **few-shot examples in `packages/intel/src/buckets.ts`**, not keyword lists.
4. Semantic relevance is the product. Hard spam rules exist because leaky buckets + recency filled the feed with garbage; they are a safety net, not a replacement for buckets.

Unfinished bar: searches should feel **smart enough** that new DBC builders show up without us having to add their handle first. Widen queries when asked; do not widen into LP/ticker.

---

## Taxonomy (nuance the operator asked for)

- Hackathon / bounty / demo-day **on the Meteora track** — own bucket, not “generic builder.”
- Official Meteora — **override-only** (`OFFICIAL_HANDLES`), never wins embeddings.
- Pad-ecosystem drama — third-party movement around the nine screener pads (queries may be Meteora-free on purpose).
- Memes / shitposts **about Meteora tech** are a real bucket (culture), but they are **low lead weight** and must not drown the public ecosystem lane. Public lane = builders / pads / DBC / drama.
- Tighten every bucket toward “would Vesper or a DBC builder care?”

---

## Public feed UX

| Prompt | Intent |
| --- | --- |
| Heading | **Meteora Ecosystem feed** (below the pad table) |
| Layout | Masonry / size-of-post columns (Big Week–style), not equal-height one-column, not empty gaps |
| Motion | Infinite scroll, no View more |
| Chrome | No bucket tags, no lead numbers, no “435 posts” |
| Lanes | Ecosystem (default) vs Official; posts vs replies |
| Weight | Native HTML cards, light. Embeds if used must not make the page lag |
| Premium | Editorial, not toy dashboard. Design-audit bar: “not premium enough” was a real reject |
| Mix | Ecosystem mix, but **tight** — pad accounts, founders when known, new DBC builders, pad drama |

**Good posts (operator: “these ones are actually good”):** ChainRot, NousPad, Ethics, Dann (`@dannxbt`), Vesper, Ember Curve, StonkOptions announcements (e.g. employment rewards) — **DBC/pad progress**, not ticker tape.

**Bad posts (operator: “how is this even related”):** dexevents, `$JOBLESS`, `$BLEND`, LP army, trading contests, CA/mcap bots, “one line” iframe column, old posts burying a same-day pad announcement.

---

## Liveness

> “ur treating it like static feed, if the original post got deleted why is this showing up… just have a very very lively feed”

Hourly (or better) X lookup of feed IDs → tombstone. Do not keep rendering deleted tweets because they are still in JSONL. Edited-on-X awareness is **desired** and may still be incomplete — do not drop it.

---

## Topology

- UI: RWAScreener Next.js on rwascreener `web`.
- Intel API: rwascreener `intel` (`packages/intel`), volume `/data`.
- Scanner: rwascreener `scanner`, `INTEL_ROLE=scanner`, cron `0 * * * *`.
- Web → intel: `METEORA_INTEL_URL=http://${{intel.RAILWAY_PRIVATE_DOMAIN}}:8080` (use **8080**; `${{intel.PORT}}` interpolates empty).
- Do not deploy intel into `oracle`. Do not stand up a second public intel site.

---

## Still open — do not make the operator repeat these

Canonical checklist: **`docs/TODO.md`**. Those were asked for and are **not fully done**. Treat them as current requirements.

1. **Semantic vs scraper** — feed should read as “understood relevance,” not allowlist + regex. Keep improving bucket examples and DBC-lane judgment.
2. **Unknown builders** — standing search must still catch people integrating DBC who are not on the pad table yet.
3. **All languages** — queries are agnostic; classifier is English. Non-English DBC/pad posts will be under-bucketed until we have a better gate.
4. **Edited posts** — deleted is tombstoned; edits are not a first-class live update.
5. **Founder handles** — pad accounts yes; founders when `projects.json` has them. Do not invent `devX`.
6. **Premium feed chrome** — masonry + native cards shipped; a full brand/premium pass was deferred (`docs/brand.md`). Heading exists; visual density should stay Big Week–like (variable card size).
7. **Memes bucket vs public lane** — culture bucket exists; public ecosystem lane stays builder/DBC/drama. Do not dump shitposts back on the homepage without being asked.
8. **Pad-first ranking** — tried, buried fresh posts, **reverted to newest-first**. Do not reintroduce a rank that hides today’s StonkOptions/Ember/ChainRot.
9. **Project knowledge graph** — v0 is `GET /api/projects` + harvested timelines. Not a full graph DB yet. Keep adding Stocklana/DBC builder handles as they surface. Stocklana’s 13 submissions are not listed publicly on the hackathon page.
10. **Vesper interest** — v0 live: reads her @/replies/quotes (`GET /api/vesper-interest`), harvests new handles same scan, feed bypass without changing newest-first rank. No Following/Likes API (app bearer). Personal @s currently leak into the list. Example: https://x.com/vesper792/status/2100474095473455266 (`stardotfun`, `getstonkoptions`, `adamcreates_`).
11. **X credit budget** — hourly scan; 402 = credits gone. Do not spam live search while iterating filters.
12. **Ops leftovers** — operator can delete old meteco / meteora-intel Railway; persist intel model cache across redeploys; GitHub auto-deploy for web is flaky (`railway up -s web`).

---

## Operator quotes (keep the voice)

- “this monitor is to find ecosystem movements which could be overlooked”
- “official meteora ones should be separate and should not mix”
- “categorizations more nuanced… one that is revolving around hackathons”
- “drama revolving around all of meteora's ecosystem launchpad listed here at meteora.fyi”
- “semantic discovery and getting all languages in is most important”
- “no LP and LP army stuff”
- “Follow footprint of vesper @vesper792”
- “who will want to click the button, they should load as i scroll down”
- “no need for time filters rn”
- “show those first like stonk options posts, ember posts, new builders wanting to build on meteora dbc”
- “how many times i have to remind u its a builder related meteora ecosystem launchpads drama related feed”
- “the scrolling is so so sofucking laggy” → native cards, not iframe stack
- “lets take down meteora intel website fully, basically have only dbc screener as our main feed”
- “meteora intel is more than a monitor its a knowledge graph and a second brain”
