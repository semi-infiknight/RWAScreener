import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildClassificationDocument,
  classifyText,
  warmupClassifier,
} from "../src/classifier.js";
import { DEMO_POSTS } from "../src/fixtures.js";
import {
  loadMentions,
  saveMention,
  topLeads,
  upsertMentions,
  type MentionRecord,
} from "../src/store.js";

const SCRATCH =
  process.env.METEORA_INTEL_TEST_SCRATCH ||
  mkdtempSync(join(tmpdir(), "meteora-intel-persist-"));

describe("persist + leads path", () => {
  before(async () => {
    process.env.METEORA_INTEL_DATA_DIR = join(SCRATCH, "data");
    // Isolate from the real production seed: empty scratch stores get the 4-post
    // demo seed, which the demo upserts below replace one-for-one.
    process.env.METEORA_INTEL_SEED = "demo";
    await warmupClassifier();
  });

  it("writes classified mentions to JSONL and loads lead-ranked rows without noise", async () => {
    const records: MentionRecord[] = [];
    for (const post of DEMO_POSTS) {
      const classification = await classifyText(
        buildClassificationDocument({
          text: post.text,
          authorUsername: post.authorUsername,
          authorBio: post.authorBio,
        }),
      );
      records.push({
        id: post.id,
        text: post.text,
        url: `https://x.com/${post.authorUsername}/status/${post.id}`,
        queryId: "demo",
        author: {
          id: post.id,
          username: post.authorUsername,
          bio: post.authorBio,
        },
        classification,
        scannedAt: new Date().toISOString(),
      });
    }

    upsertMentions(records);

    const path = join(process.env.METEORA_INTEL_DATA_DIR!, "mentions.jsonl");
    assert.ok(existsSync(path), "mentions.jsonl must exist");
    const raw = readFileSync(path, "utf8");
    assert.ok(raw.includes("pad_builder"));
    assert.ok(raw.includes("degenxyz"));

    const loaded = loadMentions();
    assert.equal(loaded.length, DEMO_POSTS.length);

    const leads = topLeads(loaded);
    assert.ok(leads.length >= 3);
    assert.ok(!leads.some((l) => l.classification.primary === "noise_retail_hype"));
    assert.ok(leads.every((l) => l.classification.leadScore > 0));

    // append path also works
    const extra = { ...records[0]!, id: "demo-extra" };
    saveMention(extra);
    assert.equal(loadMentions().length, DEMO_POSTS.length + 1);
  });
});
