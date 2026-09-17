# Plan: Paginate the meteora.fyi feed payload

## Goal
First paint of the ecosystem feed is ~24 lean cards, not 400+ full classified records and images.

## Approach
Intel `/api/feed` defaults to `limit=24`, strips `scores`/bios. Screener asks for pages and has Load more. In-memory JSONL cache so page 2 isn’t a full disk reread.

## Blast radius
API default for `/api/feed` changes from “all rows” to 24. `/api/export` still dumps everything. Screener is the only public consumer.

## E2E
- [ ] `GET /api/feed` → 24 posts, `count` still total, no `scores`
- [ ] `?page=2&limit=24` next slice
- [ ] meteora.fyi first fetch is small; Load more appends
- [ ] Lane/window still reset to page 1
