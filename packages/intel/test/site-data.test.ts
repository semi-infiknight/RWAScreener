import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Classification } from "../src/classifier.js";
import type { MentionRecord } from "../src/store.js";
import type { BucketId } from "../src/buckets.js";
import {
  filterFeed,
  rankLeaderboard,
  windowCounts,
  type TimeWindow,
} from "../src/site-data.js";

function cls(
  primary: BucketId,
  opts: { lead?: number; suppressed?: boolean } = {},
): Classification {
  const suppressed = Boolean(opts.suppressed);
  return {
    primary,
    primaryScore: 0.8,
    secondary: [],
    scores: {} as Classification["scores"],
    leadScore: suppressed ? 0 : (opts.lead ?? 0.5),
    suppressed,
    signalScore: suppressed ? 0.4 : 0.8,
    noiseScore: suppressed ? 0.9 : 0.2,
    gatedAsNoise: suppressed,
  };
}

function mention(
  id: string,
  username: string,
  createdAt: string,
  primary: BucketId,
  extra: { lead?: number; suppressed?: boolean; text?: string } = {},
): MentionRecord {
  return {
    id,
    text: extra.text ?? `${id} about meteora DBC`,
    createdAt,
    scannedAt: createdAt,
    url: `https://x.com/${username}/status/${id}`,
    queryId: "test",
    author: { id, username, name: username },
    classification: cls(primary, extra),
  };
}

// Fixed "now": Wednesday 2026-09-16 15:00 UTC
// ISO week starts Monday 2026-09-14
const NOW = new Date("2026-09-16T15:00:00.000Z");

const ROWS: MentionRecord[] = [
  mention("n1", "degenxyz", "2026-09-16T12:00:00.000Z", "noise_retail_hype", {
    suppressed: true,
    text: "MET 100x",
  }),
  mention("t1", "launch_founder", "2026-09-16T10:00:00.000Z", "pad_migrating_or_exploring", {
    lead: 0.9,
    text: "need partner config help for our DBC launchpad",
  }),
  mention("t2", "rwa_dev", "2026-09-15T08:00:00.000Z", "scaffold_forker", {
    lead: 0.7,
    text: "forked fun launch from Invent",
  }),
  mention("w1", "pad_builder", "2026-09-14T02:00:00.000Z", "builder_integrating_sdk", {
    lead: 0.8,
    text: "sdk cpi shipping on DBC",
  }),
  mention("lw1", "oldpad", "2026-09-09T12:00:00.000Z", "pad_live_on_dbc", {
    lead: 0.4,
    text: "we went live on DBC last week",
  }),
  mention("t3", "launch_founder", "2026-09-16T11:00:00.000Z", "pad_migrating_or_exploring", {
    lead: 0.6,
    text: "still looking for intros to integrate DBC",
  }),
];

describe("site feed / time windows / leaderboard", () => {
  it("default feed omits suppressed noise and keeps builder rows", () => {
    const feed = filterFeed(ROWS, { window: "all", now: NOW });
    const handles = feed.map((m) => m.author?.username);
    assert.ok(!handles.includes("degenxyz"));
    assert.ok(handles.includes("launch_founder"));
    assert.ok(handles.includes("rwa_dev"));
    assert.ok(handles.includes("pad_builder"));
    assert.equal(
      feed.every((m) => !m.classification.suppressed),
      true,
    );
  });

  it("time windows change membership using createdAt", () => {
    const today = filterFeed(ROWS, { window: "today", now: NOW }).map((m) => m.id);
    const week = filterFeed(ROWS, { window: "week", now: NOW }).map((m) => m.id);
    const last = filterFeed(ROWS, { window: "last_week", now: NOW }).map((m) => m.id);
    const all = filterFeed(ROWS, { window: "all", now: NOW }).map((m) => m.id);

    assert.deepEqual(today.sort(), ["t1", "t3"].sort());
    assert.ok(week.includes("t1") && week.includes("t2") && week.includes("w1"));
    assert.ok(!week.includes("lw1"));
    assert.deepEqual(last, ["lw1"]);
    assert.ok(all.includes("lw1") && all.includes("t1"));
    assert.ok(!all.includes("n1"));

    const counts = windowCounts(ROWS, NOW);
    assert.equal(counts.today, 2);
    assert.equal(counts.last_week, 1);
    assert.ok(counts.week >= counts.today);
    assert.ok(counts.all > counts.week);
  });

  it("leaderboard ranks by lead score sum, omits noise, groups handles", () => {
    const board = rankLeaderboard(ROWS, { window: "all", now: NOW });
    const handles = board.map((r) => r.handle);
    assert.ok(!handles.includes("degenxyz"));

    const founder = board.find((r) => r.handle === "launch_founder")!;
    assert.equal(founder.posts, 2);
    assert.equal(founder.leadScoreSum, 1.5);
    assert.equal(founder.topBucket, "pad_migrating_or_exploring");

    assert.equal(board[0]!.handle, "launch_founder");
    for (let i = 1; i < board.length; i++) {
      assert.ok(board[i - 1]!.leadScoreSum >= board[i]!.leadScoreSum);
    }
  });

  it("falls back to scannedAt when createdAt is missing", () => {
    const row: MentionRecord = {
      ...ROWS[1]!,
      id: "scan-only",
      createdAt: undefined,
      scannedAt: "2026-09-16T13:00:00.000Z",
    };
    const today = filterFeed([...ROWS, row], { window: "today", now: NOW });
    assert.ok(today.some((m) => m.id === "scan-only"));
  });

  it("hides tombstoned (deleted on X) posts from the public feed", () => {
    const row = mention("gone1", "ghost", "2026-09-16T12:00:00.000Z", "pad_live_on_dbc", {
      text: "this post was deleted on X",
    });
    row.deletedAt = "2026-09-16T12:05:00.000Z";
    const feed = filterFeed([...ROWS, row], { window: "all", now: NOW });
    assert.ok(!feed.some((m) => m.id === "gone1"));
  });

  it("hides LP army posts from the public feed", () => {
    const row = mention("lp1", "farmer", "2026-09-16T12:00:00.000Z", "memes_meteora_ecosystem", {
      text: "LP army assemble we farming tonight",
    });
    const feed = filterFeed([...ROWS, row], { window: "all", now: NOW });
    assert.ok(!feed.some((m) => m.id === "lp1"));
  });

  it("hides dex-events bot posts from the public feed", () => {
    const row = mention("dx1", "dexevents_cfo", "2026-09-16T14:00:00.000Z", "infra_bot_indexer", {
      text: "🔥METEORA_PAIR_DLMM🔥 CHECK EVENTS: dexevents.fun/token/abc",
    });
    const feed = filterFeed([...ROWS, row], { window: "all", now: NOW });
    assert.ok(!feed.some((m) => m.id === "dx1"));
  });

  it("hides ticker CA calls even when the classifier says hackathon_builder", () => {
    const row = mention("ca1", "bitecong", "2026-09-16T14:00:00.000Z", "hackathon_builder", {
      text: "🤖 AI Signal (SOL) $JOBLESS CA: 88E4cWZvAvab1gDbjEhVEAbf43h1UgPngdqpUt3D9VrR JOBLESS on Raydium",
    });
    const feed = filterFeed([...ROWS, row], { window: "all", now: NOW });
    assert.ok(!feed.some((m) => m.id === "ca1"));
  });

  it("hides memes / infra / LP-alpha buckets from the ecosystem lane", () => {
    const rows = [
      mention("m1", "degen", "2026-09-16T14:00:00.000Z", "memes_meteora_ecosystem", {
        text: "gladiators on meteora dbc lmao",
      }),
      mention("i1", "botter", "2026-09-16T14:00:00.000Z", "infra_bot_indexer", {
        text: "Indexing new Meteora DBC pools for our trading bot",
      }),
      mention("lp2", "farmer2", "2026-09-16T14:00:00.000Z", "lp_alpha_vault_launch", {
        text: "Using Meteora Alpha Vault for a fair launch before DAMM liquidity",
      }),
    ];
    const feed = filterFeed([...ROWS, ...rows], { window: "all", now: NOW });
    assert.ok(!feed.some((m) => ["m1", "i1", "lp2"].includes(m.id)));
    assert.ok(feed.some((m) => m.id === "t1"));
  });

  it("hides pump.fun ticker shills that only name-drop Meteora", () => {
    const row = mention("bl1", "zbr2qjidxi25552", "2026-09-16T14:00:00.000Z", "pad_live_on_dbc", {
      text: "$BLEND 140K\n\nhb7QGTtC8sXSQVAymn7aRdtbN3kdDwbQyihtHiipump\n\nPump 曲线，讲的是 Meteora 那套。",
    });
    const feed = filterFeed([...ROWS, row], { window: "all", now: NOW });
    assert.ok(!feed.some((m) => m.id === "bl1"));
  });

  it("keeps pad drama and live DBC pads", () => {
    const drama = mention("d1", "watcher", "2026-09-16T14:00:00.000Z", "pad_ecosystem_drama", {
      text: "Bags.fm volume fell off a cliff this week",
    });
    const feed = filterFeed([...ROWS, drama], { window: "all", now: NOW });
    assert.ok(feed.some((m) => m.id === "d1"));
  });

  it("surfaces newest DBC/pad posts first, not old pad history", () => {
    const pad = mention("p1", "embercurve", "2026-09-10T12:00:00.000Z", "pad_ecosystem_drama", {
      lead: 0.2,
      text: "graduations were messy this week",
    });
    const builder = mention("b1", "newpad", "2026-09-16T14:00:00.000Z", "pad_migrating_or_exploring", {
      lead: 0.9,
      text: "Anyone integrating Meteora DBC for our launchpad?",
    });
    const noiseish = mention("x1", "random", "2026-09-16T14:30:00.000Z", "competitor_pain", {
      lead: 0.8,
      text: "These launchpads on Solana are getting out of hand",
    });
    const feed = filterFeed([...ROWS, pad, builder, noiseish], { window: "all", now: NOW });
    assert.equal(feed[0]!.id, "b1");
    assert.ok(feed.some((m) => m.id === "p1"));
    assert.ok(!feed.some((m) => m.id === "x1"));
  });

  it("keeps tracked pad announcements even if BGE labels them noise", () => {
    const row = mention("st2", "getstonkoptions", "2026-09-16T13:01:14.000Z", "noise_retail_hype", {
      suppressed: true,
      text: "$22.9K in stock rewards waiting for verified employees from McDonalds",
    });
    const feed = filterFeed([...ROWS, row], { window: "all", now: NOW });
    assert.ok(feed.some((m) => m.id === "st2"));
  });

  it("keeps accounts Vesper is currently talking to, even if BGE says noise", () => {
    const vesper = mention("vp1", "vesper792", "2026-09-16T14:00:00.000Z", "hackathon_builder", {
      text: "this @freshpadxyz stocklana dbc clip launch is the one",
    });
    const row = mention("fp1", "freshpadxyz", "2026-09-16T14:10:00.000Z", "noise_retail_hype", {
      suppressed: true,
      text: "clip launches as a coin paired with a stock",
    });
    const feed = filterFeed([...ROWS, vesper, row], { window: "all", now: NOW });
    assert.ok(feed.some((m) => m.id === "fp1"));
  });
});

void (0 as unknown as TimeWindow);
