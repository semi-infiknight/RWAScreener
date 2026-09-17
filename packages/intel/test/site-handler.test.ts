import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { AddressInfo } from "node:net";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = mkdtempSync(join(tmpdir(), "meteora-intel-handler-"));
process.env.METEORA_INTEL_DATA_DIR = seedDir;
cpSync(
  join(pkgRoot, "fixtures", "demo-mentions.jsonl"),
  join(seedDir, "mentions.jsonl"),
);

const { handleRequest } = await import("../src/site-server.js");

describe("shipped HTTP handler (Railway entry)", () => {
  let server: ReturnType<typeof createServer>;
  let origin: string;

  before(async () => {
    server = createServer(handleRequest);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  async function get(path: string, redirect: RequestRedirect = "follow") {
    const res = await fetch(`${origin}${path}`, { redirect });
    const body = await res.text();
    return { status: res.status, body, location: res.headers.get("location") };
  }

  it("GET / redirects to the DBC screener", async () => {
    const { status, location } = await get("/", "manual");
    assert.equal(status, 301);
    assert.equal(location, "https://www.meteora.fyi/");
  });

  it("GET /leaderboard redirects to the DBC screener", async () => {
    const { status, location } = await get("/leaderboard", "manual");
    assert.equal(status, 301);
    assert.equal(location, "https://www.meteora.fyi/");
  });

  it("GET /health is ok for Railway", async () => {
    const { status, body } = await get("/health");
    assert.equal(status, 200);
    assert.equal(body, "ok");
  });

  it("GET /api/feed still returns classified posts without noise", async () => {
    const { status, body } = await get("/api/feed");
    assert.equal(status, 200);
    const data = JSON.parse(body) as {
      count: number;
      posts: { author?: { username?: string }; classification?: { scores?: unknown } }[];
      hasMore: boolean;
      limit: number;
    };
    assert.equal(data.limit, 24);
    const handles = data.posts.map((p) => p.author?.username);
    assert.ok(handles.includes("launch_founder"));
    assert.ok(handles.includes("pad_builder"));
    assert.ok(handles.includes("rwa_dev"));
    assert.ok(!handles.includes("degenxyz"));
    assert.equal(data.posts.some((p) => p.classification?.scores), false);
  });

  it("GET /api/feed paginates", async () => {
    const first = JSON.parse((await get("/api/feed?limit=1&page=1")).body) as {
      count: number;
      posts: { id: string }[];
      hasMore: boolean;
    };
    const second = JSON.parse((await get("/api/feed?limit=1&page=2")).body) as {
      posts: { id: string }[];
    };
    assert.ok(first.count >= 2);
    assert.equal(first.posts.length, 1);
    assert.equal(first.hasMore, true);
    assert.notEqual(first.posts[0]!.id, second.posts[0]!.id);
  });

  it("POST /api/tombstone drops deleted ids from /api/feed", async () => {
    process.env.INGEST_TOKEN = "handler-test-token";
    const res = await fetch(`${origin}/api/tombstone`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ingest-token": "handler-test-token",
      },
      body: JSON.stringify({ ids: ["demo-3"] }),
    });
    assert.equal(res.status, 200);
    const payload = (await res.json()) as { marked: number };
    assert.equal(payload.marked, 1);
    const after = JSON.parse((await get("/api/feed")).body) as {
      posts: { author?: { username?: string } }[];
    };
    const handles = after.posts.map((p) => p.author?.username);
    assert.ok(!handles.includes("launch_founder"));
  });
});
