import type { BucketId } from "./buckets.js";
import { BUCKET_BY_ID, OFFICIAL_HANDLES } from "./buckets.js";
import {
  isCompetitorPadAccount,
  isPublicEcosystemPost,
  isRetailFeedSpam,
} from "./ecosystem-anchor.js";
import type { MentionRecord } from "./store.js";

export type TimeWindow = "all" | "today" | "week" | "last_week";

/** ecosystem = builder/BD signal (default) · official = official Meteora accounts only */
export type Lane = "ecosystem" | "official";

/** posts = standalone posts (default) · replies = replies to other tweets */
export type PostType = "posts" | "replies";

export type FeedQuery = {
  window?: TimeWindow;
  includeNoise?: boolean;
  lane?: Lane;
  postType?: PostType;
  q?: string;
  bucket?: BucketId | "";
  now?: Date;
};

export type LeaderRow = {
  handle: string;
  name: string;
  posts: number;
  leadScoreSum: number;
  topBucket: BucketId;
  followers: number;
  sampleUrl: string;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday 00:00 UTC of the ISO week containing `d`. */
export function startOfIsoWeek(d: Date): Date {
  const start = startOfUtcDay(d);
  const day = start.getUTCDay();
  const iso = day === 0 ? 6 : day - 1;
  start.setUTCDate(start.getUTCDate() - iso);
  return start;
}

export function windowRange(
  window: TimeWindow,
  now = new Date(),
): { start?: Date; end?: Date } {
  if (window === "all") return {};
  if (window === "today") {
    return { start: startOfUtcDay(now), end: now };
  }
  if (window === "week") {
    return { start: startOfIsoWeek(now), end: now };
  }
  const weekStart = startOfIsoWeek(now);
  const lastStart = new Date(weekStart);
  lastStart.setUTCDate(lastStart.getUTCDate() - 7);
  return { start: lastStart, end: weekStart };
}

export function mentionTimestamp(m: MentionRecord): Date {
  const raw = m.createdAt || m.scannedAt;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function inWindow(
  m: MentionRecord,
  window: TimeWindow,
  now = new Date(),
): boolean {
  const { start, end } = windowRange(window, now);
  const t = mentionTimestamp(m).getTime();
  if (start && t < start.getTime()) return false;
  if (end && t >= end.getTime()) return false;
  return true;
}

export function isNoise(m: MentionRecord): boolean {
  return Boolean(m.classification.suppressed || m.classification.gatedAsNoise);
}

/**
 * Official Meteora accounts — by assigned bucket OR by handle, so legacy
 * records classified before the override still land in the official lane.
 */
export function isOfficial(m: MentionRecord): boolean {
  if (m.classification.primary === "official_meteora") return true;
  const handle = (m.author?.username ?? "").toLowerCase();
  return OFFICIAL_HANDLES.has(handle);
}

export function filterFeed(
  mentions: MentionRecord[],
  query: FeedQuery = {},
): MentionRecord[] {
  const window = query.window ?? "all";
  const now = query.now ?? new Date();
  const needle = (query.q ?? "").trim().toLowerCase();
  const bucket = query.bucket || "";
  const lane = query.lane ?? "ecosystem";
  const postType = query.postType ?? "posts";

  return mentions
    .filter((m) => !m.deletedAt)
    .filter((m) => !isCompetitorPadAccount(m.author?.username))
    .filter((m) => {
      if (query.includeNoise) return true;
      if (lane !== "ecosystem") {
        return !isNoise(m) && !isRetailFeedSpam(m.text || "", m.author?.username);
      }
      return isPublicEcosystemPost(
        m.text || "",
        m.author?.username,
        m.classification.primary,
        isNoise(m),
      );
    })
    .filter((m) => (lane === "official" ? isOfficial(m) : !isOfficial(m)))
    .filter((m) => (postType === "replies" ? Boolean(m.isReply) : !m.isReply))
    .filter((m) => inWindow(m, window, now))
    .filter((m) => (bucket ? m.classification.primary === bucket : true))
    .filter((m) => {
      if (!needle) return true;
      const hay = [
        m.text,
        m.author?.username ?? "",
        m.author?.name ?? "",
        m.classification.primary,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle.replace(/^@/, ""));
    })
    .sort((a, b) => mentionTimestamp(b).getTime() - mentionTimestamp(a).getTime());
}

export function windowCounts(
  mentions: MentionRecord[],
  now = new Date(),
  includeNoise = false,
  lane: Lane = "ecosystem",
  postType: PostType = "posts",
): Record<TimeWindow, number> {
  const windows: TimeWindow[] = ["all", "today", "week", "last_week"];
  const out = {} as Record<TimeWindow, number>;
  for (const w of windows) {
    out[w] = filterFeed(mentions, { window: w, now, includeNoise, lane, postType }).length;
  }
  return out;
}

export function rankLeaderboard(
  mentions: MentionRecord[],
  query: FeedQuery & { limit?: number } = {},
): LeaderRow[] {
  // Leaderboard is a BD-lead board: official accounts never rank.
  const rows = filterFeed(mentions, query).filter((m) => !isOfficial(m));
  const byHandle = new Map<
    string,
    { posts: MentionRecord[]; lead: number; followers: number; name: string }
  >();

  for (const m of rows) {
    const handle = (m.author?.username || "unknown").toLowerCase();
    const cur = byHandle.get(handle) ?? {
      posts: [],
      lead: 0,
      followers: m.author?.followers ?? 0,
      name: m.author?.name || m.author?.username || handle,
    };
    cur.posts.push(m);
    cur.lead += m.classification.leadScore;
    if ((m.author?.followers ?? 0) > cur.followers) {
      cur.followers = m.author?.followers ?? 0;
    }
    if (m.author?.name) cur.name = m.author.name;
    byHandle.set(handle, cur);
  }

  const ranked: LeaderRow[] = [...byHandle.entries()].map(([handle, g]) => {
    const bucketCounts = new Map<BucketId, number>();
    for (const p of g.posts) {
      const id = p.classification.primary;
      bucketCounts.set(id, (bucketCounts.get(id) ?? 0) + 1);
    }
    const topBucket = [...bucketCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const sample = g.posts[0]!;
    return {
      handle,
      name: g.name,
      posts: g.posts.length,
      leadScoreSum: Number(g.lead.toFixed(4)),
      topBucket,
      followers: g.followers,
      sampleUrl: sample.url,
    };
  });

  ranked.sort((a, b) => {
    if (b.leadScoreSum !== a.leadScoreSum) return b.leadScoreSum - a.leadScoreSum;
    if (b.posts !== a.posts) return b.posts - a.posts;
    return a.handle.localeCompare(b.handle);
  });

  return ranked.slice(0, query.limit ?? 50);
}

export function bucketLabel(id: BucketId): string {
  return BUCKET_BY_ID[id]?.label ?? id;
}
