import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Classification } from "../src/classifier.js";
import type { MentionRecord } from "../src/store.js";
import { filterFeed, rankLeaderboard, windowCounts } from "../src/site-data.js";
import { renderPage } from "../src/site-html.js";

function row(
  id: string,
  username: string,
  primary: Classification["primary"],
  suppressed: boolean,
): MentionRecord {
  return {
    id,
    text: `${username} says something about meteora DBC`,
    createdAt: new Date().toISOString(),
    scannedAt: new Date().toISOString(),
    url: `https://x.com/${username}/status/${id}`,
    queryId: "demo",
    author: { id, username, name: username },
    classification: {
      primary,
      primaryScore: 0.8,
      secondary: [],
      scores: {} as Classification["scores"],
      leadScore: suppressed ? 0 : 0.7,
      suppressed,
      signalScore: 0.8,
      noiseScore: suppressed ? 0.9 : 0.2,
      gatedAsNoise: suppressed,
    },
  };
}

describe("site HTML render", () => {
  it("feed HTML includes builder handles/buckets and omits noise handle", () => {
    const mentions: MentionRecord[] = [
      row("demo-1", "pad_builder", "builder_integrating_sdk", false),
      row("demo-2", "degenxyz", "noise_retail_hype", true),
      row("demo-3", "launch_founder", "pad_migrating_or_exploring", false),
    ];
    const feed = filterFeed(mentions, { window: "all" });
    const board = rankLeaderboard(mentions, { window: "all" });
    const html = renderPage({
      view: "feed",
      window: "all",
      lane: "ecosystem",
      postType: "posts",
      q: "",
      bucket: "",
      feed,
      board,
      counts: windowCounts(mentions),
      officialCount: 0,
      totalStored: mentions.length,
      noiseHidden: 1,
      page: 1,
      totalPages: 1,
      totalFeed: feed.length,
    });
    assert.match(html, /launch_founder/);
    assert.match(html, /pad_builder/);
    assert.match(html, /Launchpad exploring/);
    assert.doesNotMatch(html, /degenxyz/);
    assert.match(html, /Meteora Intel/);
    assert.match(html, /id="bucket"/);
    assert.match(html, /class="topic"/);
    assert.doesNotMatch(html, /class="ticker"/);
    assert.doesNotMatch(html, /Hype hidden/);
    assert.doesNotMatch(html, /class="stats"/);
    assert.doesNotMatch(html, /DBC · builders/);
  });

  it("leaderboard HTML lists signal accounts only", () => {
    const mentions: MentionRecord[] = [
      row("demo-3", "launch_founder", "pad_migrating_or_exploring", false),
      row("demo-2", "degenxyz", "noise_retail_hype", true),
    ];
    const html = renderPage({
      view: "leaderboard",
      window: "all",
      lane: "ecosystem",
      postType: "posts",
      q: "",
      bucket: "",
      feed: filterFeed(mentions),
      board: rankLeaderboard(mentions),
      counts: windowCounts(mentions),
      officialCount: 0,
      totalStored: 2,
      noiseHidden: 1,
      page: 1,
      totalPages: 1,
      totalFeed: 2,
    });
    assert.match(html, /@launch_founder/);
    assert.doesNotMatch(html, /degenxyz/);
    assert.match(html, /1 account/);
  });

  it("official accounts live in their own lane, never the leaderboard", () => {
    const mentions: MentionRecord[] = [
      row("demo-1", "pad_builder", "builder_integrating_sdk", false),
      row("off-1", "MeteoraAG", "official_meteora", false),
    ];
    // default ecosystem lane excludes official (by bucket or handle)
    const eco = filterFeed(mentions, { window: "all" });
    assert.equal(eco.length, 1);
    assert.equal(eco[0]!.author?.username, "pad_builder");
    // official lane shows only official
    const off = filterFeed(mentions, { window: "all", lane: "official" });
    assert.equal(off.length, 1);
    assert.equal(off[0]!.author?.username, "MeteoraAG");
    // leaderboard excludes official even when it's the high-scorer
    const board = rankLeaderboard(mentions);
    assert.deepEqual(board.map((r) => r.handle), ["pad_builder"]);
    // render official lane
    const html = renderPage({
      view: "feed",
      window: "all",
      lane: "official",
      postType: "posts",
      q: "",
      bucket: "",
      feed: off,
      board,
      counts: windowCounts(mentions, new Date(), false, "official"),
      officialCount: 1,
      totalStored: 2,
      noiseHidden: 0,
      page: 1,
      totalPages: 1,
      totalFeed: 1,
    });
    assert.match(html, /1 official/);
    assert.doesNotMatch(html, /id="bucket"/);
    assert.match(html, /MeteoraAG/);
  });

  it("renders avatar images and media grids when present", () => {
    const m = row("demo-9", "media_builder", "builder_integrating_sdk", false);
    m.author = {
      ...m.author!,
      avatarUrl: "https://pbs.twimg.com/profile_images/x/y_normal.jpg",
    };
    m.media = [
      { type: "photo", url: "https://pbs.twimg.com/media/abc.jpg" },
      { type: "photo", url: "https://pbs.twimg.com/media/def.jpg" },
    ];
    const html = renderPage({
      view: "feed",
      window: "all",
      lane: "ecosystem",
      postType: "posts",
      q: "",
      bucket: "",
      feed: [m],
      board: [],
      counts: windowCounts([m]),
      officialCount: 0,
      totalStored: 1,
      noiseHidden: 0,
      page: 1,
      totalPages: 1,
      totalFeed: 1,
    });
    assert.match(html, /img class="avatar" src="https:\/\/pbs\.twimg\.com\/profile_images/);
    assert.match(html, /class="media m2"/);
    assert.match(html, /pbs\.twimg\.com\/media\/abc\.jpg\?name=small/);
    assert.match(html, /pbs\.twimg\.com\/media\/def\.jpg\?name=small/);
  });

  it("renders X-style engagement footer, verified badge, quote marker", () => {
    const m = row("demo-10", "verified_dev", "pad_live_on_dbc", false);
    m.author = { ...m.author!, verified: true };
    m.isQuote = true;
    m.metrics = { likes: 1200, replies: 42, reposts: 8, quotes: 1, impressions: 2500000 };
    const html = renderPage({
      view: "feed",
      window: "all",
      lane: "ecosystem",
      postType: "posts",
      q: "",
      bucket: "",
      feed: [m],
      board: [],
      counts: windowCounts([m]),
      officialCount: 0,
      totalStored: 1,
      noiseHidden: 0,
      page: 1,
      totalPages: 1,
      totalFeed: 1,
    });
    assert.match(html, /aria-label="verified"/);
    assert.match(html, /· quote/);
    assert.match(html, /aria-label="replies"/);
    assert.match(html, /aria-label="likes"/);
    assert.match(html, /aria-label="views"/);
    assert.match(html, />42</); // replies raw
    assert.match(html, />1\.2K</); // likes compact
    assert.match(html, />2\.5M</); // views compact
    assert.doesNotMatch(html, /lead 0/); // lead score removed from cards
  });

  it("posts/replies toggle filters the feed", () => {
    const post = row("demo-p1", "standalone_dev", "builder_integrating_sdk", false);
    const reply = row("demo-r1", "reply_dev", "pad_migrating_or_exploring", false);
    reply.isReply = true;
    const mentions = [post, reply];
    // default = posts only
    const posts = filterFeed(mentions, { window: "all", postType: "posts" });
    assert.equal(posts.length, 1);
    assert.equal(posts[0]!.author?.username, "standalone_dev");
    // replies view
    const replies = filterFeed(mentions, { window: "all", postType: "replies" });
    assert.equal(replies.length, 1);
    assert.equal(replies[0]!.author?.username, "reply_dev");
    // toggle renders in feed view
    const html = renderPage({
      view: "feed",
      window: "all",
      lane: "ecosystem",
      postType: "posts",
      q: "",
      bucket: "",
      feed: posts,
      board: [],
      counts: windowCounts(mentions, new Date(), false, "ecosystem", "posts"),
      officialCount: 0,
      totalStored: 2,
      noiseHidden: 0,
      page: 1,
      totalPages: 1,
      totalFeed: 1,
    });
    assert.match(html, /class="toggle"/);
    assert.match(html, /class="toggle-opt is-active"[^>]*>posts</);
    assert.match(html, /class="toggle-opt"[^>]*>replies/);
  });
});
