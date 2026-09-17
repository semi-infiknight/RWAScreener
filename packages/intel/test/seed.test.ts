import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDemoId } from "../src/store.js";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("production seed is real X posts", () => {
  it("fixtures/seed-mentions.jsonl has no demo-* ids when present", () => {
    const path = join(pkg, "fixtures", "seed-mentions.jsonl");
    if (!existsSync(path)) {
      assert.fail(
        "fixtures/seed-mentions.jsonl missing — run npm run backfill -- --seed",
      );
    }
    const rows = readFileSync(path, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { id: string; author?: { username?: string } });
    assert.ok(rows.length >= 1, "seed must contain at least one real post");
    for (const r of rows) {
      assert.equal(isDemoId(r.id), false, `demo id leaked into seed: ${r.id}`);
      assert.notEqual(r.author?.username, "degenxyz");
      assert.notEqual(r.author?.username, "pad_builder");
    }
  });
});
