import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasEcosystemAnchor,
  isDexEventBotSpam,
  isLpArmyNoise,
  isRetailFeedSpam,
  LIST_FEED_HANDLES,
} from "../src/ecosystem-anchor.js";
import { SEARCH_QUERIES } from "../src/queries.js";
import { postsFromXResponse } from "../src/x-client.js";

describe("ecosystem anchors", () => {
  it("keeps screener pad handles without the word Meteora", () => {
    assert.equal(hasEcosystemAnchor("volume fell off a cliff this week", "embercurve"), true);
    assert.equal(hasEcosystemAnchor("Bags.fm volume fell off a cliff this week"), true);
    assert.equal(hasEcosystemAnchor("clip launches as a coin", "ChainRot_app"), true);
  });

  it("drops unrelated ecosystems", () => {
    assert.equal(hasEcosystemAnchor("Arc launchpad is live on Base", "some_dev"), false);
  });

  it("detects LP army phrasing", () => {
    assert.equal(isLpArmyNoise("LP army assemble"), true);
    assert.equal(isLpArmyNoise("using Alpha Vault for a fair launch"), false);
  });

  it("detects dex-events alert bots", () => {
    assert.equal(
      isDexEventBotSpam(
        "🔥METEORA_PAIR_DLMM🔥 CHECK EVENTS: dexevents.fun/token/abc",
        "dexevents_cfo",
      ),
      true,
    );
    assert.equal(
      isDexEventBotSpam("INFLUENCER POST: KOL SignalX\nCHECK EVENTS: dexevents.fun", "eventsdex_miu"),
      true,
    );
    assert.equal(
      isDexEventBotSpam("shipping our DBC launchpad this week", "embercurve"),
      false,
    );
  });

  it("detects ticker CA / AI-signal / contest spam", () => {
    assert.equal(
      isRetailFeedSpam(
        "🤖 AI Signal (SOL) $JOBLESS CA: 88E4cWZvAvab1gDbjEhVEAbf43h1UgPngdqpUt3D9VrR",
        "bitecong",
      ),
      true,
    );
    assert.equal(
      isRetailFeedSpam("Still 20 days left for the $DBC trading contest on ObsidianSwap"),
      true,
    );
    assert.equal(
      isRetailFeedSpam("the technical side of solana:6rHkNb7HCtkpvdnVJsBCZHH5dw3AndqEjfmbEGhooR7t is kind of nuts"),
      true,
    );
    assert.equal(
      isRetailFeedSpam("Our launchpad is live on Meteora DBC — creators can launch today", "embercurve"),
      false,
    );
    assert.equal(
      isRetailFeedSpam(
        "$BLEND 140K\n\nhb7QGTtC8sXSQVAymn7aRdtbN3kdDwbQyihtHiipump\n\nPump 曲线，讲的是 Meteora 那套。",
      ),
      true,
    );
  });
});

describe("X list-feed seed", () => {
  it("follows vesper, official, and screener pads", () => {
    assert.ok(LIST_FEED_HANDLES.includes("vesper792"));
    assert.ok(LIST_FEED_HANDLES.includes("meteoraag"));
    assert.ok(LIST_FEED_HANDLES.includes("bagsapp"));
    assert.ok(LIST_FEED_HANDLES.includes("embercurve"));
    assert.ok(LIST_FEED_HANDLES.includes("embercurvefun"));
    assert.ok(!LIST_FEED_HANDLES.includes("launchonsf"));
    assert.ok(LIST_FEED_HANDLES.includes("getstonkoptions"));
    assert.ok(LIST_FEED_HANDLES.includes("stardotfun"));
    assert.ok(LIST_FEED_HANDLES.includes("chainrot_app"));
    assert.ok(LIST_FEED_HANDLES.includes("nouspad"));
    assert.ok(LIST_FEED_HANDLES.includes("stocklaunchdbc_"));
  });
});

describe("postsFromXResponse", () => {
  it("flags quotes and replies the way X expansions do", () => {
    const posts = postsFromXResponse(
      {
        data: [
          {
            id: "1",
            text: "quote",
            author_id: "u1",
            referenced_tweets: [{ type: "quoted", id: "9" }],
          },
          {
            id: "2",
            text: "reply",
            author_id: "u2",
            in_reply_to_user_id: "u9",
            referenced_tweets: [{ type: "replied_to", id: "8" }],
          },
          {
            id: "3",
            text: "thread continue",
            author_id: "u2",
            in_reply_to_user_id: "u2",
            referenced_tweets: [{ type: "replied_to", id: "2" }],
          },
        ],
        includes: {
          users: [
            { id: "u1", username: "vesper792" },
            { id: "u2", username: "embercurve" },
            { id: "u9", username: "chainrot_app" },
            { id: "u10", username: "nouspad" },
          ],
          tweets: [{ id: "9", text: "quoted pad update", author_id: "u10" }],
        },
      },
      "tl_test",
    );
    assert.equal(posts[0]?.isQuote, true);
    assert.equal(posts[1]?.isReply, true);
    assert.notEqual(posts[2]?.isReply, true);
    assert.equal(posts[0]?.author?.username, "vesper792");
    assert.equal(posts[0]?.quotedAuthors?.[0]?.username, "nouspad");
    assert.equal(posts[1]?.repliedTo?.username, "chainrot_app");
    assert.equal(posts[0]?.queryId, "tl_test");
  });
});

describe("standing search pool", () => {
  it("watches vesper, screener pad handles, and Meteora hackathons", () => {
    const ids = SEARCH_QUERIES.map((q) => q.id);
    assert.ok(ids.includes("vesper_footprint"));
    assert.ok(ids.includes("hackathon_meteora"));
    assert.ok(ids.includes("stocklana_dbc"));
    const blob = SEARCH_QUERIES.map((q) => q.query).join("\n");
    assert.match(blob, /from:embercurve/);
    assert.match(blob, /from:embercurvefun/);
    assert.doesNotMatch(blob, /from:LaunchOnSF/);
    assert.match(blob, /from:getstonkoptions/);
    assert.match(blob, /from:BagsApp/);
    assert.match(blob, /from:vesper792/);
    assert.match(blob, /LParmy/);
    assert.match(blob, /dexevents\.fun/);
  });
});
