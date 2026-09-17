import { lookupTweetPresence } from "./x-client.js";

/**
 * Ask X which recent feed IDs still exist; POST missing IDs to /api/tombstone
 * so deleted posts leave the ranked list (embeds also hide them client-side).
 */

const BATCH = 100;
const PAGES = 4;
const PAGE_SIZE = 48;

function ingestOrigin(ingestUrl: string): string {
  return ingestUrl.replace(/\/api\/ingest\/?$/, "").replace(/\/$/, "");
}

async function feedIds(origin: string, page: number): Promise<string[]> {
  const params = new URLSearchParams({
    lane: "ecosystem",
    window: "all",
    type: "posts",
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  const res = await fetch(`${origin}/api/feed?${params}`);
  if (!res.ok) {
    throw new Error(`feed GET failed (${res.status})`);
  }
  const data = (await res.json()) as { posts?: { id?: string }[] };
  return (data.posts ?? []).map((p) => p.id).filter((id): id is string => Boolean(id));
}

async function tombstone(origin: string, token: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const res = await fetch(`${origin}/api/tombstone`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-token": token,
    },
    body: JSON.stringify({ ids }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`tombstone POST failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const result = JSON.parse(text) as { marked?: number };
  return result.marked ?? 0;
}

export async function sweepDeletedPosts(opts: {
  ingestUrl: string;
  ingestToken: string;
}): Promise<{ checked: number; missing: number; marked: number }> {
  const origin = ingestOrigin(opts.ingestUrl);
  const ids: string[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const batch = await feedIds(origin, page);
    ids.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  const unique = [...new Set(ids)];
  const missing: string[] = [];
  for (let i = 0; i < unique.length; i += BATCH) {
    const slice = unique.slice(i, i + BATCH);
    const result = await lookupTweetPresence(slice);
    missing.push(...result.missing);
  }
  const marked = await tombstone(origin, opts.ingestToken, missing);
  console.log(
    `sweep-deleted: checked ${unique.length} live-feed ids, missing ${missing.length}, marked ${marked}`,
  );
  return { checked: unique.length, missing: missing.length, marked };
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("sweep-deleted.ts")
) {
  const ingestUrl = process.env.INGEST_URL?.trim();
  const ingestToken = process.env.INGEST_TOKEN?.trim();
  if (!ingestUrl || !ingestToken) {
    console.error("Missing INGEST_URL or INGEST_TOKEN");
    process.exit(1);
  }
  sweepDeletedPosts({ ingestUrl, ingestToken }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
