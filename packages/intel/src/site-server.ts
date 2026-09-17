import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { BUCKET_BY_ID, type BucketId } from "./buckets.js";
import {
  ingestPosts,
  upsertRecords,
  type IngestPost,
} from "./ingest.js";
import { loadMentions, tombstoneMentions, type MentionRecord } from "./store.js";
import {
  filterFeed,
  rankLeaderboard,
  type Lane,
  type PostType,
  type TimeWindow,
} from "./site-data.js";

const WINDOWS = new Set<TimeWindow>(["all", "today", "week", "last_week"]);

function parseWindow(raw: string | null): TimeWindow {
  if (raw && WINDOWS.has(raw as TimeWindow)) return raw as TimeWindow;
  return "all";
}

function parseLane(raw: string | null): Lane {
  return raw === "official" ? "official" : "ecosystem";
}

function parsePostType(raw: string | null): PostType {
  return raw === "replies" ? "replies" : "posts";
}

function parseBucket(raw: string | null): BucketId | "" {
  if (raw && raw in BUCKET_BY_ID && raw !== "noise_retail_hype") return raw as BucketId;
  return "";
}

function send(res: ServerResponse, status: number, body: string, type: string) {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
  });
  res.end(body);
}

const BODY_CAP = 5_000_000;
const INGEST_BATCH_MAX = 2_000;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_CAP) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Shared-secret gate for the scanner push endpoint; disabled when unset. */
function ingestAuthorized(req: IncomingMessage): boolean {
  const expected = process.env.INGEST_TOKEN?.trim();
  if (!expected) return false;
  const header = req.headers["x-ingest-token"];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleIngest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
    return;
  }
  if (!ingestAuthorized(req)) {
    send(res, 401, "Unauthorized", "text/plain; charset=utf-8");
    return;
  }
  let payload: { posts?: IngestPost[]; upsert?: boolean; records?: MentionRecord[] };
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    send(res, 400, "Invalid JSON body", "text/plain; charset=utf-8");
    return;
  }
  // Upsert mode: trusted full records (rehydrate/backfill tooling), replace by id.
  if (payload.upsert) {
    const records = Array.isArray(payload.records) ? payload.records : [];
    if (records.length > INGEST_BATCH_MAX) {
      send(res, 413, `Batch too large (max ${INGEST_BATCH_MAX})`, "text/plain; charset=utf-8");
      return;
    }
    const result = upsertRecords(records);
    console.log(`[ingest:upsert] received=${result.received} saved=${result.saved} skipped=${result.skipped}`);
    send(res, 200, JSON.stringify(result), "application/json; charset=utf-8");
    return;
  }
  const posts = Array.isArray(payload.posts) ? payload.posts : [];
  if (posts.length > INGEST_BATCH_MAX) {
    send(res, 413, `Batch too large (max ${INGEST_BATCH_MAX})`, "text/plain; charset=utf-8");
    return;
  }
  const result = await ingestPosts(posts);
  console.log(
    `[ingest] received=${result.received} saved=${result.saved} skipped=${result.skipped} errors=${result.errors.length}`,
  );
  send(res, 200, JSON.stringify(result), "application/json; charset=utf-8");
}

/** Full JSONL dump for rehydrate/backup tooling; same shared-secret auth. */
function handleExport(req: IncomingMessage, res: ServerResponse) {
  if (!ingestAuthorized(req)) {
    send(res, 401, "Unauthorized", "text/plain; charset=utf-8");
    return;
  }
  const rows = loadMentions();
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  res.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

async function handleTombstone(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
    return;
  }
  if (!ingestAuthorized(req)) {
    send(res, 401, "Unauthorized", "text/plain; charset=utf-8");
    return;
  }
  let payload: { ids?: unknown };
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    send(res, 400, "Invalid JSON body", "text/plain; charset=utf-8");
    return;
  }
  const ids = Array.isArray(payload.ids)
    ? payload.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (ids.length > INGEST_BATCH_MAX) {
    send(res, 413, `Batch too large (max ${INGEST_BATCH_MAX})`, "text/plain; charset=utf-8");
    return;
  }
  const marked = tombstoneMentions(ids);
  send(
    res,
    200,
    JSON.stringify({ received: ids.length, marked }),
    "application/json; charset=utf-8",
  );
}

const FEED_PAGE = 24;
const FEED_PAGE_MAX = 48;

function toFeedCard(m: MentionRecord) {
  return {
    id: m.id,
    text: m.text,
    createdAt: m.createdAt,
    url: m.url,
    author: m.author
      ? {
          username: m.author.username,
          name: m.author.name,
          avatarUrl: m.author.avatarUrl,
          verified: m.author.verified,
        }
      : undefined,
    media: m.media,
    metrics: m.metrics,
    isQuote: m.isQuote,
    isReply: m.isReply,
    classification: { primary: m.classification.primary },
  };
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host || "127.0.0.1";
  const url = new URL(req.url || "/", `http://${host}`);
  const window = parseWindow(url.searchParams.get("window"));
  const lane = parseLane(url.searchParams.get("lane"));
  const postType = parsePostType(url.searchParams.get("type"));
  const q = url.searchParams.get("q") ?? "";
  const bucket = parseBucket(url.searchParams.get("bucket"));
  if (url.pathname === "/api/ingest") {
    await handleIngest(req, res);
    return;
  }
  if (url.pathname === "/api/export") {
    handleExport(req, res);
    return;
  }
  if (url.pathname === "/api/tombstone") {
    await handleTombstone(req, res);
    return;
  }

  if (url.pathname === "/health") {
    send(res, 200, "ok", "text/plain; charset=utf-8");
    return;
  }
  if (url.pathname === "/" || url.pathname === "/leaderboard") {
    res.writeHead(301, {
      location: "https://www.meteora.fyi/",
      "cache-control": "no-store",
    });
    res.end();
    return;
  }

  const mentions = loadMentions();
  const query = { window, q, bucket: bucket || undefined, lane, postType };

  if (url.pathname === "/api/feed") {
    const feed = filterFeed(mentions, query);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
    const rawLimit = Number(url.searchParams.get("limit") || FEED_PAGE);
    const limit = Math.min(FEED_PAGE_MAX, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : FEED_PAGE));
    const start = (page - 1) * limit;
    const posts = feed.slice(start, start + limit).map(toFeedCard);
    send(
      res,
      200,
      JSON.stringify({
        window,
        lane,
        postType,
        count: feed.length,
        page,
        limit,
        hasMore: start + posts.length < feed.length,
        posts,
      }),
      "application/json; charset=utf-8",
    );
    return;
  }
  if (url.pathname === "/api/leaderboard") {
    // Leaderboard is always the ecosystem lead board (no official accounts).
    const board = rankLeaderboard(mentions, { window, q, bucket: bucket || undefined });
    send(res, 200, JSON.stringify({ window, count: board.length, accounts: board }), "application/json; charset=utf-8");
    return;
  }

  send(res, 404, "Not found", "text/plain; charset=utf-8");
}

const port = Number(process.env.PORT || 8787);
/** Railway health checks need 0.0.0.0; override with HOST=127.0.0.1 locally if needed. */
const host = process.env.HOST || "0.0.0.0";

export function startSiteServer(listenPort = port, listenHost = host) {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error("[site] handler error", err);
      if (!res.headersSent) {
        send(res, 500, "Internal error", "text/plain; charset=utf-8");
      } else {
        res.end();
      }
    });
  });
  server.listen(listenPort, listenHost, () => {
    console.log(`Meteora Intel API http://${listenHost}:${listenPort}`);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("site-server.ts")) {
  startSiteServer();
}
