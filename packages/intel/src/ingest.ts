import {
  classifyPost,
  warmupClassifier,
} from "./classifier.js";
import {
  knownMentionIds,
  mentionUrl,
  saveMention,
  upsertMentions,
  type MentionMedia,
  type MentionRecord,
} from "./store.js";
import type { XPost, XUser } from "./x-client.js";
import { hasEcosystemAnchor } from "./ecosystem-anchor.js";

/** Raw post payload accepted by POST /api/ingest (mirrors SearchedPost). */
export type IngestPost = {
  post: XPost;
  author?: XUser;
  media?: { media_key: string; type: string; url?: string; preview_image_url?: string }[];
  isQuote?: boolean;
  isReply?: boolean;
  queryId?: string;
};

export type IngestResult = {
  received: number;
  saved: number;
  classified: number;
  skipped: number;
  errors: string[];
};

function toMentionMedia(media: IngestPost["media"]): MentionMedia[] | undefined {
  if (!media?.length) return undefined;
  const out: MentionMedia[] = [];
  for (const m of media) {
    const url = m.url ?? m.preview_image_url;
    if (url) out.push({ type: m.type, url });
  }
  return out.length ? out : undefined;
}

/** Map a raw searched/pushed post to a stored record (shared shape with cli.ts). */
export async function recordFromRaw(item: IngestPost): Promise<MentionRecord> {
  const classification = await classifyPost({
    text: item.post.text,
    authorName: item.author?.name,
    authorUsername: item.author?.username,
    authorBio: item.author?.description,
  });
  // Off-topic guard: no Meteora/Solana/screener-pad footprint (Arc, ETH, etc.).
  // Pad-watch posts often never say "Meteora" — keep those via pad handles/names.
  if (
    !hasEcosystemAnchor(item.post.text || "", item.author?.username) &&
    classification.primary !== "official_meteora" &&
    !classification.suppressed
  ) {
    classification.suppressed = true;
    classification.gatedAsNoise = true;
    classification.leadScore = 0;
  }
  return {
    id: item.post.id,
    text: item.post.text,
    createdAt: item.post.created_at,
    url: mentionUrl(item.author?.username, item.post.id),
    queryId: item.queryId ?? "push",
    author: item.author
      ? {
          id: item.author.id,
          username: item.author.username,
          name: item.author.name,
          bio: item.author.description,
          followers: item.author.public_metrics?.followers_count,
          avatarUrl: item.author.profile_image_url,
          verified: item.author.verified,
        }
      : undefined,
    media: toMentionMedia(item.media),
    isQuote: item.isQuote,
    isReply: item.isReply,
    conversationId: item.post.conversation_id,
    metrics: item.post.public_metrics
      ? {
          likes: item.post.public_metrics.like_count,
          replies: item.post.public_metrics.reply_count,
          reposts: item.post.public_metrics.retweet_count,
          quotes: item.post.public_metrics.quote_count,
          impressions: item.post.public_metrics.impression_count,
        }
      : undefined,
    classification,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Classify + dedup + persist posts pushed by the stateless scanner.
 * The web service owns the model and the (volume-backed) store.
 */
export async function ingestPosts(items: IngestPost[]): Promise<IngestResult> {
  await warmupClassifier();
  const known = knownMentionIds();
  let classified = 0;
  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of items) {
    const post = item?.post;
    if (!post?.id || !post.text) {
      skipped++;
      continue;
    }
    if (known.has(post.id)) {
      skipped++;
      continue;
    }
    try {
      const record = await recordFromRaw(item);
      classified++;
      saveMention(record);
      known.add(post.id);
      saved++;
    } catch (err) {
      if (errors.length < 5) errors.push(`${post.id}: ${String(err)}`);
    }
  }

  return { received: items.length, saved, classified, skipped, errors };
}

/**
 * Trusted path for rehydrate/backfill tooling: full records (already
 * classified) replace stored rows by id. No re-classification, no dedup.
 */
export function upsertRecords(records: MentionRecord[]): IngestResult {
  const valid = records.filter(
    (r) => r?.id && r.text && r.classification?.primary,
  );
  if (valid.length) upsertMentions(valid);
  const skipped = records.length - valid.length;
  return {
    received: records.length,
    saved: valid.length,
    classified: 0,
    skipped,
    errors: [],
  };
}
