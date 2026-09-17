# Plan: Vesper interest graph (read, don't just index)

## Goal
Intel **reads** `@vesper792` posts, replies, quotes, and @-mentions so it knows who she is engaging **now**, harvests those accounts, and keeps the ecosystem timeline aligned with her current interest — not a static keyword index of her tweets.

## Scope
### In
- Parse Vesper's own posts: @mentions, reply-to, quoted authors
- Persist rolling `vesper-interest.json` on the intel volume
- Same-scan: harvest timelines of top interest handles (cap)
- Treat those handles like watched builders in the public feed (bypass noise; **newest-first still**)
- `GET /api/vesper-interest`
- ETHOS + tests
- Ingest https://x.com/vesper792/status/2100474095473455266

### Out
- X Following/Likes APIs (app bearer often cannot read those)
- Changing public rank to "Vesper-first" (that buried fresh pads before)
- LLM summaries of her posts

## Approach
Interest = **who she interacts with**, derived from her timeline. Search already indexes `from:vesper792`; that is not enough.

## Blast radius
More harvest X calls (capped). Feed membership for accounts she is talking to.

## Verification
`npm test` + `npm run typecheck` in `packages/intel`
