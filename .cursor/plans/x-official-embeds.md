# Plan: Official X embed timeline

## Goal
Ecosystem feed uses **Twitter for Websites** patterns: official `twitter-wjs` loader, `blockquote.twitter-tweet` markup, `twttr.widgets.load`, single-column 550px timeline (X’s embed max-width). Deleted widgets hide after `rendered`.

## Why
Custom `createTweet` + masonry fights iframe height and is not how publish.twitter.com / widgets.js expect a feed. Standard path is blockquotes + one widgets.js + load(container) on infinite scroll.

## In
- `RWAScreener/lib/x-widgets.ts` — official bootstrap
- Feed: blockquotes, twitter.com status URLs, timeline column
- Hide unavailable after `rendered`

## Out
- react-tweet / unofficial syndication API
