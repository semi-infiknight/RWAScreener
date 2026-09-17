import { SEARCH_QUERIES } from "./queries.js";
import {
  searchXPages,
  XSearchError,
  type SearchedPost,
} from "./x-client.js";
import { harvestListFeed } from "./harvest-timelines.js";
import { sweepDeletedPosts } from "./sweep-deleted.js";

/**
 * Stateless hourly scanner (Railway cron). Fetches recent X posts and pushes
 * them to the site's /api/ingest; classification + storage live server-side,
 * so this service stays fetch-only (no transformer model download).
 *
 * Env: INGEST_URL, INGEST_TOKEN, X_BEARER_TOKEN (via config), optional
 * PUSH_SCAN_WINDOW_MIN (default 75 — overlap; server dedups by post id).
 */

const INGEST_URL = process.env.INGEST_URL?.trim();
const INGEST_TOKEN = process.env.INGEST_TOKEN?.trim();
const WINDOW_MIN = Number(process.env.PUSH_SCAN_WINDOW_MIN ?? 75);
/** Pad profile timelines look back ~7 days so announcements are not missed between crons. */
const LIST_TWEET_WINDOW_MIN = Number(
  process.env.PUSH_SCAN_LIST_TWEET_WINDOW_MIN ?? 7 * 24 * 60,
);
const MAX_RESULTS = Number(process.env.PUSH_SCAN_MAX_RESULTS ?? 25);
const BATCH = 100;

async function postBatch(batch: SearchedPost[]): Promise<number> {
  const res = await fetch(INGEST_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-token": INGEST_TOKEN!,
    },
    body: JSON.stringify({ posts: batch }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ingest POST failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const result = JSON.parse(text) as { saved?: number };
  return result.saved ?? 0;
}

export async function runPushScan(): Promise<void> {
  if (!INGEST_URL || !INGEST_TOKEN) {
    throw new Error("Missing INGEST_URL or INGEST_TOKEN env");
  }
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const listTweetSince = new Date(Date.now() - LIST_TWEET_WINDOW_MIN * 60_000).toISOString();
  console.log(
    `push-scan: ${SEARCH_QUERIES.length} queries, window ${WINDOW_MIN}min (since ${since}); list tweets since ${listTweetSince}`,
  );

  const byId = new Map<string, SearchedPost>();
  let creditsOut = false;

  try {
    const listPosts = await harvestListFeed({
      tweetStartTime: listTweetSince,
      mentionStartTime: since,
      maxTweets: 25,
      maxMentions: 10,
    });
    for (const item of listPosts) byId.set(item.post.id, item);
    console.log(`push-scan: list-feed ${listPosts.length} posts`);
  } catch (err) {
    if (err instanceof XSearchError && err.status === 402) {
      creditsOut = true;
      console.error("push-scan: list-feed 402 credits depleted");
    } else {
      console.error(`push-scan: list-feed ${String(err)}`);
    }
  }

  for (const q of SEARCH_QUERIES) {
    try {
      const { posts } = await searchXPages({
        query: q.query,
        queryId: q.id,
        maxResults: MAX_RESULTS,
        maxPages: 1,
        startTime: since,
      });
      for (const item of posts) byId.set(item.post.id, item);
      console.log(`  [${q.id}] ${posts.length} posts`);
    } catch (err) {
      if (err instanceof XSearchError && err.status === 402) {
        creditsOut = true;
        console.error(`  [${q.id}] 402 credits depleted — stopping early`);
        break;
      }
      console.error(`  [${q.id}] ${String(err)}`);
    }
  }

  const items = [...byId.values()];
  console.log(`push-scan: ${items.length} unique posts fetched`);
  let saved = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    saved += await postBatch(items.slice(i, i + BATCH));
  }
  console.log(`push-scan: done — ${saved} new saved server-side`);
  try {
    await sweepDeletedPosts({ ingestUrl: INGEST_URL, ingestToken: INGEST_TOKEN });
  } catch (err) {
    console.error(`push-scan: sweep-deleted failed: ${String(err)}`);
  }
  if (creditsOut) {
    console.error("push-scan: X API credits depleted; pushed partial window");
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("push-scan.ts")
) {
  runPushScan().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
