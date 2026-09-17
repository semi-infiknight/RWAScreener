import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OFFICIAL_HANDLES } from "./buckets.js";
import { getDataDir } from "./config.js";
import { COMPETITOR_PAD_HANDLES, LIST_FEED_HANDLES } from "./ecosystem-anchor.js";
import type { MentionRecord } from "./store.js";
import type { SearchedPost } from "./x-client.js";

export const VESPER_HANDLE = "vesper792";

/** Mega / official / competitor — not a denylist of people. */
const SKIP_INTEREST = new Set([
  VESPER_HANDLE,
  ...OFFICIAL_HANDLES,
  "solana",
  "toly",
  "vibhu",
  "joinfrontier",
  "elonmusk",
  "pmarc",
  "aeyakovenko",
  "support",
  ...COMPETITOR_PAD_HANDLES,
]);

const AT_RE = /@([A-Za-z0-9_]{1,15})/g;

export type InterestHit = {
  handle: string;
  weight: number;
  via: ("mention" | "reply" | "quote")[];
};

function skip(handle: string): boolean {
  const h = handle.toLowerCase().replace(/^@/, "");
  return !h || SKIP_INTEREST.has(h);
}

function bump(
  map: Map<string, InterestHit>,
  handle: string | undefined,
  kind: InterestHit["via"][number],
  weight: number,
) {
  const h = (handle ?? "").toLowerCase().replace(/^@/, "");
  if (skip(h)) return;
  const cur = map.get(h) ?? { handle: h, weight: 0, via: [] };
  cur.weight += weight;
  if (!cur.via.includes(kind)) cur.via.push(kind);
  map.set(h, cur);
}

function isVesperAuthor(username?: string): boolean {
  return (username ?? "").toLowerCase().replace(/^@/, "") === VESPER_HANDLE;
}

/** Read Vesper's own posts: who she @'d, replied to, quoted. */
export function interestFromVesperPosts(posts: SearchedPost[]): InterestHit[] {
  const map = new Map<string, InterestHit>();
  for (const item of posts) {
    if (!isVesperAuthor(item.author?.username)) continue;
    const text = item.post.text || "";
    for (const m of text.matchAll(AT_RE)) bump(map, m[1], "mention", 1);
    for (const m of item.post.entities?.mentions ?? []) {
      bump(map, m.username, "mention", 1);
    }
    if (item.repliedTo?.username && item.isReply) {
      bump(map, item.repliedTo.username, "reply", 3);
    }
    for (const q of item.quotedAuthors ?? []) {
      bump(map, q.username, "quote", 3);
    }
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight || a.handle.localeCompare(b.handle));
}

const MS_DAY = 86_400_000;

/** Same signal from stored mentions (Vesper's own rows, recent window). */
export function interestFromMentions(
  mentions: MentionRecord[],
  windowDays = 14,
  now = new Date(),
): InterestHit[] {
  const cutoff = now.getTime() - windowDays * MS_DAY;
  const map = new Map<string, InterestHit>();
  for (const row of mentions) {
    if (row.deletedAt) continue;
    if (!isVesperAuthor(row.author?.username)) continue;
    const t = Date.parse(row.createdAt || row.scannedAt);
    if (Number.isFinite(t) && t < cutoff) continue;
    const text = row.text || "";
    for (const m of text.matchAll(AT_RE)) bump(map, m[1], "mention", 1);
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight || a.handle.localeCompare(b.handle));
}

export function vesperInterestHandleSet(
  mentions: MentionRecord[],
  windowDays = 14,
  now = new Date(),
): Set<string> {
  return new Set(interestFromMentions(mentions, windowDays, now).map((h) => h.handle));
}

export function isVesperInterestAccount(
  username: string | undefined,
  interest: Set<string>,
): boolean {
  const h = (username ?? "").toLowerCase().replace(/^@/, "");
  return Boolean(h) && interest.has(h);
}

export function persistVesperInterest(hits: InterestHit[]): void {
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "vesper-interest.json"),
    JSON.stringify(
      { updatedAt: new Date().toISOString(), handles: hits.slice(0, 40) },
      null,
      2,
    ),
    "utf8",
  );
}

function isQuoteOrReply(hit: InterestHit): boolean {
  return hit.via.includes("quote") || hit.via.includes("reply");
}

/** Handles to timeline-harvest this scan (not already on the standing list). */
export function harvestTargetsFromInterest(hits: InterestHit[], cap = 12): string[] {
  const standing = new Set(LIST_FEED_HANDLES.map((h) => h.toLowerCase()));
  const out: string[] = [];
  for (const hit of hits) {
    if (standing.has(hit.handle)) continue;
    // Bare @mentions are not a harvest prior — that dumped DearS / AVAX / art quotes.
    if (!isQuoteOrReply(hit)) continue;
    out.push(hit.handle);
    if (out.length >= cap) break;
  }
  return out;
}
