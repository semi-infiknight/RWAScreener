import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { AddressInfo } from "node:net";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = mkdtempSync(join(tmpdir(), "meteora-intel-ingest-"));
process.env.METEORA_INTEL_DATA_DIR = seedDir;
process.env.INGEST_TOKEN = "test-secret";
cpSync(
  join(pkgRoot, "fixtures", "demo-mentions.jsonl"),
  join(seedDir, "mentions.jsonl"),
);

const { handleRequest } = await import("../src/site-server.js");

const BUILDER_POST = {
  post: {
    id: "ingest-builder-1",
    text: "Shipping our launchpad on Meteora DBC this week — PoolConfig + dynamic-bonding-curve-sdk CPI done, graduating to DAMM v2.",
    created_at: "2026-09-16T06:00:00.000Z",
    public_metrics: { like_count: 3, reply_count: 1, retweet_count: 0, quote_count: 0, impression_count: 50 },
  },
  author: {
    id: "u-ingest-1",
    username: "ingest_pad",
    name: "Ingest Pad",
    description: "Building Solana launch infra",
    public_metrics: { followers_count: 120 },
  },
  queryId: "test",
};

const NOISE_POST = {
  post: {
    id: "ingest-noise-1",
    text: "$MET to the moon 100x tonight buy the dip!!!",
    created_at: "2026-09-16T06:01:00.000Z",
  },
  author: { id: "u-ingest-2", username: "ingest_degen", description: "calls only" },
  queryId: "test",
};

describe("POST /api/ingest (scanner push path)", () => {
  let server: ReturnType<typeof createServer>;
  let origin: string;

  before(async () => {
    server = createServer((req, res) => {
      void handleRequest(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  async function postIngest(body: unknown, token?: string) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers["x-ingest-token"] = token;
    const res = await fetch(`${origin}/api/ingest`, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.text() };
  }

  it("rejects calls without the ingest token", async () => {
    const noToken = await postIngest({ posts: [] });
    assert.equal(noToken.status, 401);
    const wrongToken = await postIngest({ posts: [] }, "wrong");
    assert.equal(wrongToken.status, 401);
  });

  it("rejects malformed JSON", async () => {
    const { status } = await postIngest("not json{", "test-secret");
    assert.equal(status, 400);
  });

  it("classifies and persists pushed posts; noise is stored but hidden", async () => {
    const { status, body } = await postIngest(
      { posts: [BUILDER_POST, NOISE_POST] },
      "test-secret",
    );
    assert.equal(status, 200);
    const result = JSON.parse(body);
    assert.equal(result.received, 2);
    assert.equal(result.saved, 2);

    // demo seed: 4 posts (3 signal visible). +1 signal ingested → feed shows 4.
    const feed = await fetch(`${origin}/api/feed`).then((r) => r.json());
    assert.equal(feed.count, 4);
    const text = JSON.stringify(feed);
    assert.match(text, /ingest_pad/);
    assert.doesNotMatch(text, /ingest_degen/);

    const stored = await fetch(`${origin}/api/leaderboard`).then((r) => r.json());
    assert.ok(stored.count >= 4);
  });

  it("dedups on re-POST of the same ids", async () => {
    const { status, body } = await postIngest(
      { posts: [BUILDER_POST, NOISE_POST] },
      "test-secret",
    );
    assert.equal(status, 200);
    const result = JSON.parse(body);
    assert.equal(result.saved, 0);
    assert.equal(result.skipped, 2);
  });
});
