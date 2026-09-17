import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  harvestTargetsFromInterest,
  interestFromMentions,
  interestFromVesperPosts,
} from "../src/vesper-interest.js";
import type { MentionRecord } from "../src/store.js";
import type { SearchedPost } from "../src/x-client.js";

function vesperPost(partial: Partial<SearchedPost> & { text: string }): SearchedPost {
  return {
    post: {
      id: partial.post?.id ?? "v1",
      text: partial.text,
      author_id: "vesper-id",
      entities: partial.post?.entities,
    },
    author: { id: "vesper-id", username: "vesper792" },
    isQuote: partial.isQuote,
    isReply: partial.isReply,
    repliedTo: partial.repliedTo,
    quotedAuthors: partial.quotedAuthors,
    queryId: "tl_vesper792",
  };
}

describe("vesper interest", () => {
  it("reads quotes, replies, and mentions — skips solana/official", () => {
    const hits = interestFromVesperPosts([
      vesperPost({
        text: "love this from @ChainRot_app and @solana",
        isQuote: true,
        quotedAuthors: [{ id: "c", username: "ChainRot_app" }],
      }),
      vesperPost({
        text: "gm",
        isReply: true,
        repliedTo: { id: "n", username: "NousPad" },
      }),
      vesperPost({
        text: "also @MeteoraAG docs",
        post: { id: "v3", text: "also @MeteoraAG docs", entities: { mentions: [{ username: "MeteoraAG" }] } },
      }),
    ]);
    const handles = hits.map((h) => h.handle);
    assert.ok(handles.includes("chainrot_app"));
    assert.ok(handles.includes("nouspad"));
    assert.ok(!handles.includes("solana"));
    assert.ok(!handles.includes("meteoraag"));
    assert.ok(!handles.includes("vesper792"));
    const chain = hits.find((h) => h.handle === "chainrot_app")!;
    assert.ok(chain.via.includes("quote"));
    assert.ok(chain.weight >= 3);
  });

  it("does not re-harvest standing list handles", () => {
    const targets = harvestTargetsFromInterest(
      [
        { handle: "embercurve", weight: 9, via: ["mention"] },
        { handle: "freshpadxyz", weight: 4, via: ["quote"] },
      ],
      12,
    );
    assert.deepEqual(targets, ["freshpadxyz"]);
  });

  it("derives current interest from stored Vesper posts", () => {
    const row = {
      id: "vp1",
      text: "this @freshpadxyz stocklana dbc build is it",
      createdAt: new Date().toISOString(),
      url: "https://x.com/vesper792/status/vp1",
      queryId: "t",
      author: { id: "v", username: "vesper792" },
      classification: {
        primary: "hackathon_builder",
        primaryScore: 0.8,
        secondary: [],
        scores: {},
        leadScore: 0.8,
        suppressed: false,
        signalScore: 0.8,
        noiseScore: 0.1,
        gatedAsNoise: false,
      },
      scannedAt: new Date().toISOString(),
    } as unknown as MentionRecord;
    const hits = interestFromMentions([row], 14);
    assert.ok(hits.some((h) => h.handle === "freshpadxyz"));
  });
});
