# Plan: Quiet the meteora.fyi ecosystem feed

## Goal
The X feed **below the DBC screener** on www.meteora.fyi feels like the rest of the pad table — posts first, not an orange dashboard.

## Scope
### In
- `RWAScreener/app/components/ecosystem-feed.tsx`
- `RWAScreener/app/globals.css` (`.eco-feed*` block only)

### Out
- meteora-intel standalone site (already restyled by mistake; leave unless asked to revert)
- Classifier, intel API, Redis cache
- Brand-design / new typefaces (site already has Inter + orange tokens)

## Approach
Match RWAScreener tokens (`--accent` orange as hairline only). CSS `column-count` masonry so `@media` no longer `display:none`s a third of cards.

## Blast radius
Web UI only on the homepage feed section.

## E2E
- [ ] Scroll past screener: feed loads
- [ ] Ecosystem / Official / posts / replies / windows still filter
- [ ] Names not truncated; topic caption; media flush
- [ ] 375 / 768 / 1280: all posts visible (no hidden columns)

## Verification
Local `next dev` + browser on `#` feed; then Railway web if linked.
