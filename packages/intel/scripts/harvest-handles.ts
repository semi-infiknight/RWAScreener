import { fetchUserTweets, lookupUsersByUsernames } from "../src/x-client.js";

const INGEST_URL = process.env.INGEST_URL?.trim();
const INGEST_TOKEN = process.env.INGEST_TOKEN?.trim();
const handles = process.argv.slice(2).map((s) => s.replace(/^@/, "")).filter(Boolean);
const start =
  process.env.START?.trim() ||
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

async function main(): Promise<void> {
  if (!INGEST_URL || !INGEST_TOKEN) throw new Error("Missing INGEST_URL or INGEST_TOKEN");
  if (handles.length === 0) throw new Error("usage: npx tsx scripts/harvest-handles.ts <handle>...");
  const users = await lookupUsersByUsernames(handles);
  const posts = [];
  for (const h of handles) {
    const u = users.get(h.toLowerCase());
    if (!u) {
      console.log("unresolved", h);
      continue;
    }
    const tweets = await fetchUserTweets({
      userId: u.id,
      queryId: `interest_${h}`,
      startTime: start,
      maxResults: 15,
    });
    console.log(h, "tweets", tweets.length);
    posts.push(...tweets);
  }
  if (posts.length === 0) return;
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-token": INGEST_TOKEN,
    },
    body: JSON.stringify({ posts }),
  });
  console.log(await res.text());
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
