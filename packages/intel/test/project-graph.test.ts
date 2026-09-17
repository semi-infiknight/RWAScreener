import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectTimelines } from "../src/project-graph.js";
import type { MentionRecord } from "../src/store.js";

function row(id: string, username: string, createdAt: string, text: string): MentionRecord {
  return {
    id,
    text,
    createdAt,
    url: `https://x.com/${username}/status/${id}`,
    queryId: "t",
    author: { id: "u", username },
    classification: {
      primary: "hackathon_builder",
      primaryScore: 0.8,
      secondary: [],
      scores: {} as MentionRecord["classification"]["scores"],
      leadScore: 0.8,
    },
    scannedAt: createdAt,
  };
}

describe("project graph timelines", () => {
  it("groups newest posts per watched builder", () => {
    const mentions = [
      row("2", "ChainRot_app", "2026-09-17T12:00:00.000Z", "We're in. Stocklana + DBC."),
      row("1", "ChainRot_app", "2026-09-16T12:00:00.000Z", "older"),
      row("9", "stranger", "2026-09-17T13:00:00.000Z", "unrelated"),
    ];
    const graph = projectTimelines(mentions, 8);
    const chain = graph.find((p) => p.handle === "chainrot_app")!;
    assert.equal(chain.postCount, 2);
    assert.equal(chain.posts[0]!.id, "2");
    assert.equal(chain.lastPostedAt, "2026-09-17T12:00:00.000Z");
    const empty = graph.find((p) => p.handle === "nouspad")!;
    assert.equal(empty.postCount, 0);
  });
});
