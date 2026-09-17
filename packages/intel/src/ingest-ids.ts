import { fetchTweetsByIds, XSearchError } from "./x-client.js";

/**
 * Fetch specific tweet IDs from X and POST them to /api/ingest.
 * Env: INGEST_URL, INGEST_TOKEN, X_BEARER_TOKEN
 *
 *   npx tsx src/ingest-ids.ts 2100208390542852097
 */

const INGEST_URL = process.env.INGEST_URL?.trim();
const INGEST_TOKEN = process.env.INGEST_TOKEN?.trim();

async function main(): Promise<void> {
  if (!INGEST_URL || !INGEST_TOKEN) {
    throw new Error("Missing INGEST_URL or INGEST_TOKEN env");
  }
  const ids = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new Error("usage: npx tsx src/ingest-ids.ts <tweetId> [tweetId...]");
  }
  const items = await fetchTweetsByIds(ids, "id_lookup");
  console.log(`ingest-ids: fetched ${items.length}/${ids.length}`);
  if (items.length === 0) return;
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-token": INGEST_TOKEN,
    },
    body: JSON.stringify({ posts: items }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ingest POST failed (${res.status}): ${text.slice(0, 300)}`);
  }
  console.log(`ingest-ids: ${text}`);
}

main().catch((err) => {
  if (err instanceof XSearchError) console.error(err.message);
  else console.error(err);
  process.exit(1);
});
