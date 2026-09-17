import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { PKG_ROOT, getDataDir, getMentionsPath, getRunsPath } from "./config.js";
import type { Classification } from "./classifier.js";
import type { BucketId } from "./buckets.js";

export type MentionMedia = {
  type: string; // photo | video | animated_gif
  url: string; // photo url or video/gif poster
};

export type MentionRecord = {
  id: string;
  text: string;
  createdAt?: string;
  url: string;
  queryId: string;
  author?: {
    id: string;
    username?: string;
    name?: string;
    bio?: string;
    followers?: number;
    avatarUrl?: string;
    verified?: boolean;
  };
  media?: MentionMedia[];
  /** Post quotes another post (referenced_tweets) */
  isQuote?: boolean;
  /** Post is a reply — including a reply to yourself (thread continue). */
  isReply?: boolean;
  /** X conversation root id. When this differs from `id`, the post is in a thread. */
  conversationId?: string;
  metrics?: {
    likes?: number;
    replies?: number;
    reposts?: number;
    quotes?: number;
    impressions?: number;
  };
  classification: Classification;
  scannedAt: string;
  /** Set when X lookup says the post is gone — hidden from the live feed. */
  deletedAt?: string;
};

export type RunRecord = {
  id: string;
  startedAt: string;
  finishedAt: string;
  queries: string[];
  fetched: number;
  classified: number;
  newSaved: number;
  errors: string[];
};

function ensureDataDir() {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function appendJsonl(path: string, row: unknown) {
  ensureDataDir();
  appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
}

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

export function seedFixturePath(): string {
  const real = join(PKG_ROOT, "fixtures", "seed-mentions.jsonl");
  const demo = join(PKG_ROOT, "fixtures", "demo-mentions.jsonl");
  if (process.env.METEORA_INTEL_SEED === "demo") return demo;
  if (existsSync(real) && readFileSync(real, "utf8").trim()) return real;
  return demo;
}

/** Copy committed seed JSONL into the data dir when the store is empty. */
export function ensureSeededMentions(): void {
  const dest = getMentionsPath();
  if (existsSync(dest) && readFileSync(dest, "utf8").trim().length > 0) return;
  const seed = seedFixturePath();
  if (!existsSync(seed)) return;
  ensureDataDir();
  copyFileSync(seed, dest);
}

export function isDemoId(id: string): boolean {
  return id.startsWith("demo-");
}

/** Write real (non-demo) mentions to the committed production seed. */
export function exportRealSeed(
  dest = join(PKG_ROOT, "fixtures", "seed-mentions.jsonl"),
): number {
  const rows = loadMentions().filter((m) => !isDemoId(m.id));
  ensureDataDir();
  writeFileSync(
    dest,
    rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""),
    "utf8",
  );
  return rows.length;
}

let mentionMemo: { key: string; mtime: number; rows: MentionRecord[] } | null = null;

export function loadMentions(): MentionRecord[] {
  ensureSeededMentions();
  const path = getMentionsPath();
  let mtime = 0;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    /* missing file */
  }
  if (mentionMemo && mentionMemo.key === path && mentionMemo.mtime === mtime) {
    return mentionMemo.rows;
  }
  const rows = readJsonl<MentionRecord>(path);
  mentionMemo = { key: path, mtime, rows };
  return rows;
}

export function knownMentionIds(): Set<string> {
  return new Set(loadMentions().map((m) => m.id));
}

export function saveMention(record: MentionRecord) {
  appendJsonl(getMentionsPath(), record);
}

export function saveRun(run: RunRecord) {
  appendJsonl(getRunsPath(), run);
}

/** Hide posts X no longer returns (deleted / withheld). */
export function tombstoneMentions(ids: string[], at = new Date().toISOString()): number {
  const want = new Set(ids.filter(Boolean));
  if (!want.size) return 0;
  const rows = loadMentions();
  let n = 0;
  const next = rows.map((m) => {
    if (!want.has(m.id) || m.deletedAt) return m;
    n += 1;
    return { ...m, deletedAt: at };
  });
  if (n === 0) return 0;
  writeFileSync(
    getMentionsPath(),
    next.map((r) => JSON.stringify(r)).join("\n") + (next.length ? "\n" : ""),
    "utf8",
  );
  mentionMemo = null;
  return n;
}

/** Replace all mentions whose ids match (used by demo --force). */
export function upsertMentions(records: MentionRecord[]) {
  ensureDataDir();
  const ids = new Set(records.map((r) => r.id));
  const kept = loadMentions().filter((m) => !ids.has(m.id));
  const next = [...kept, ...records];
  writeFileSync(
    getMentionsPath(),
    next.map((r) => JSON.stringify(r)).join("\n") + (next.length ? "\n" : ""),
    "utf8",
  );
  mentionMemo = null;
}

export function mentionUrl(username: string | undefined, id: string): string {
  const handle = username || "i";
  return `https://x.com/${handle}/status/${id}`;
}

export type BucketSummary = {
  bucket: BucketId;
  count: number;
  avgLeadScore: number;
  top: MentionRecord[];
};

export function summarizeByBucket(
  mentions: MentionRecord[],
  topN = 5,
): BucketSummary[] {
  const groups = new Map<BucketId, MentionRecord[]>();
  for (const m of mentions) {
    const id = m.classification.primary;
    const list = groups.get(id) ?? [];
    list.push(m);
    groups.set(id, list);
  }

  return [...groups.entries()]
    .map(([bucket, rows]) => {
      const sorted = [...rows].sort(
        (a, b) => b.classification.leadScore - a.classification.leadScore,
      );
      const avg =
        sorted.reduce((s, r) => s + r.classification.leadScore, 0) /
        (sorted.length || 1);
      return {
        bucket,
        count: sorted.length,
        avgLeadScore: Number(avg.toFixed(4)),
        top: sorted.slice(0, topN),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function topLeads(
  mentions: MentionRecord[],
  limit = 25,
): MentionRecord[] {
  return [...mentions]
    .filter((m) => !m.classification.suppressed && m.classification.leadScore > 0)
    .sort((a, b) => b.classification.leadScore - a.classification.leadScore)
    .slice(0, limit);
}
