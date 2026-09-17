import { X_API_BASE, requireBearerToken } from "./config.js";
import {
  exportRealSeed,
  loadMentions,
  upsertMentions,
  type MentionRecord,
} from "./store.js";
import type { XMedia, XPost, XUser } from "./x-client.js";

/**
 * Rehydrate stored mentions with media + author avatars from the X lookup API
 * (cheap vs search: 100 ids per request). Records that predate media-aware
 * scanning get images; nothing is re-classified.
 *
 * Local store (default):
 *   npm run rehydrate
 * Against the live site (export → enrich → upsert back):
 *   npm run rehydrate -- --remote=https://web-production-a5814.up.railway.app
 * Requires X_BEARER_TOKEN; remote mode requires INGEST_TOKEN.
 */

const REMOTE = process.argv
  .find((a) => a.startsWith("--remote="))
  ?.split("=")[1]
  ?.replace(/\/$/, "");
const DRY = process.argv.includes("--dry");

type LookupResponse = {
  data?: XPost[];
  includes?: { users?: XUser[]; media?: XMedia[] };
  errors?: unknown[];
};

async function lookupBatch(ids: string[]): Promise<Map<string, MentionRecord>> {
  const bearer = requireBearerToken();
  const params = new URLSearchParams({
    ids: ids.join(","),
    "tweet.fields": "attachments,author_id,referenced_tweets",
    expansions: "attachments.media_keys,author_id",
    "media.fields": "url,preview_image_url,type,width,height",
    "user.fields": "username,name,description,public_metrics,profile_image_url,verified",
  });
  const res = await fetch(`${X_API_BASE}/tweets?${params.toString()}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!res.ok) {
    throw new Error(`lookup failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const body = (await res.json()) as LookupResponse;
  const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u] as const));
  const mediaByKey = new Map(
    (body.includes?.media ?? []).map((m) => [m.media_key, m] as const),
  );
  const out = new Map<string, MentionRecord>();
  for (const post of body.data ?? []) {
    const keys = post.attachments?.media_keys ?? [];
    const media = keys
      .map((k) => mediaByKey.get(k))
      .filter((m): m is XMedia => Boolean(m))
      .map((m) => {
        const url = m.url ?? m.preview_image_url;
        return url ? { type: m.type, url } : undefined;
      })
      .filter((m): m is { type: string; url: string } => Boolean(m));
    const author = post.author_id ? users.get(post.author_id) : undefined;
    out.set(post.id, {
      // only the enrichment fields — merged onto the stored record below
      media: media.length ? media : undefined,
      author: author
        ? { id: author.id, avatarUrl: author.profile_image_url, verified: author.verified }
        : undefined,
      isQuote: post.referenced_tweets?.some((r) => r.type === "quoted") || undefined,
      isReply: post.referenced_tweets?.some((r) => r.type === "replied_to") || undefined,
    } as unknown as MentionRecord);
  }
  return out;
}

function mergeEnrichment(
  rec: MentionRecord,
  enr: MentionRecord | undefined,
): { next: MentionRecord; changed: boolean } {
  if (!enr) return { next: rec, changed: false };
  const next = { ...rec };
  let changed = false;
  if (enr.media?.length && !rec.media?.length) {
    next.media = enr.media;
    changed = true;
  }
  if (enr.isQuote !== undefined && rec.isQuote !== enr.isQuote) {
    next.isQuote = enr.isQuote;
    changed = true;
  }
  if (enr.isReply !== undefined && rec.isReply !== enr.isReply) {
    next.isReply = enr.isReply;
    changed = true;
  }
  const avatarUrl = enr.author?.avatarUrl ?? rec.author?.avatarUrl;
  const verified = enr.author?.verified ?? rec.author?.verified;
  if (avatarUrl !== rec.author?.avatarUrl || verified !== rec.author?.verified) {
    next.author = { ...next.author, avatarUrl, verified } as MentionRecord["author"];
    changed = true;
  }
  return { next, changed };
}

async function fetchRemoteRecords(base: string): Promise<MentionRecord[]> {
  const token = process.env.INGEST_TOKEN?.trim();
  if (!token) throw new Error("INGEST_TOKEN required for --remote");
  const res = await fetch(`${base}/api/export`, {
    headers: { "x-ingest-token": token },
  });
  if (!res.ok) throw new Error(`export failed (${res.status})`);
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as MentionRecord);
}

/** Railway edge can close the keep-alive socket the export reused — retry per batch. */
async function pushRemote(base: string, records: MentionRecord[]): Promise<number> {
  const token = process.env.INGEST_TOKEN!.trim();
  let saved = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const body = JSON.stringify({ upsert: true, records: batch });
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${base}/api/ingest`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-ingest-token": token },
          body,
        });
        if (!res.ok) throw new Error(`upsert failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        saved += ((await res.json()) as { saved?: number }).saved ?? 0;
        break;
      } catch (err) {
        const code = (err as { cause?: { code?: string } })?.cause?.code;
        if (code === "UND_ERR_SOCKET" && attempt < 3) continue;
        throw err;
      }
    }
  }
  return saved;
}

async function main() {
  const records = REMOTE ? await fetchRemoteRecords(REMOTE) : loadMentions();
  console.log(`rehydrate: ${records.length} stored records${REMOTE ? ` (remote ${REMOTE})` : " (local)"}`);

  const needsMedia = records.filter(
    (r) =>
      (!r.media && !r.author?.avatarUrl) ||
      r.author?.verified === undefined ||
      r.isReply === undefined,
  ).filter((r) => !r.id.startsWith("demo-"));
  console.log(`rehydrate: ${needsMedia.length} records missing media/avatar/verified/reply-flag`);

  let enriched = 0;
  const updated: MentionRecord[] = [];
  for (let i = 0; i < needsMedia.length; i += 100) {
    const batch = needsMedia.slice(i, i + 100);
    let enrichment: Map<string, MentionRecord>;
    try {
      enrichment = await lookupBatch(batch.map((r) => r.id));
    } catch (err) {
      console.error(`lookup batch ${i / 100 + 1} failed: ${String(err)}`);
      break;
    }
    for (const rec of batch) {
      const enr = enrichment.get(rec.id);
      if (!enr) continue; // deleted/unavailable post — keep stored record
      const { next, changed } = mergeEnrichment(rec, enr);
      if (changed) {
        enriched++;
        updated.push(next);
      }
    }
    console.log(`  batch ${i / 100 + 1}: ${enrichment.size}/${batch.length} resolved`);
  }

  console.log(`rehydrate: enriched ${enriched} records${DRY ? " (dry run)" : ""}`);
  if (DRY || updated.length === 0) return;

  if (REMOTE) {
    const saved = await pushRemote(REMOTE, updated);
    console.log(`rehydrate: pushed ${saved} enriched records to ${REMOTE}`);
  } else {
    upsertMentions(updated);
    const n = exportRealSeed();
    console.log(`rehydrate: local store updated; seed refreshed (${n} rows)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
