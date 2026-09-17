import type { MentionRecord } from "./store.js";

/**
 * Seed of the intel knowledge graph: watched X identities and what they are.
 * Timelines are derived from mentions.jsonl until a dedicated graph store exists.
 */
export type ProjectKind =
  | "hackathon_dbc_pad"
  | "dbc_stock_pad"
  | "dbc_builder";

export type ProjectSeed = {
  handle: string;
  name: string;
  kind: ProjectKind;
  /** What they are building — operator context, not a classifier label. */
  blurb: string;
};

export const PROJECT_SEEDS: ProjectSeed[] = [
  {
    handle: "chainrot_app",
    name: "ChainRot",
    kind: "hackathon_dbc_pad",
    blurb:
      "Stocklana: short-form clip launches as a coin paired with a stock on Meteora DBC.",
  },
  {
    handle: "nouspad",
    name: "NousPad",
    kind: "dbc_builder",
    blurb: "Hermes project passports launched through Meteora DBC, graduate to DAMM v2.",
  },
  {
    handle: "stocklaunchdbc_",
    name: "StockLaunch",
    kind: "dbc_stock_pad",
    blurb: "Pair tokens with Backpack/tokenized stocks on Meteora DBC.",
  },
  {
    handle: "emojifundotxyz",
    name: "EmojiFun",
    kind: "dbc_builder",
    blurb: "Exploring an emoji meme launchpad on Meteora DBC.",
  },
];

export const WATCHED_BUILDER_HANDLES = PROJECT_SEEDS.map((p) => p.handle);

export type ProjectTimeline = {
  handle: string;
  name: string;
  kind: ProjectKind;
  blurb: string;
  lastPostedAt?: string;
  postCount: number;
  posts: {
    id: string;
    text: string;
    createdAt?: string;
    url: string;
  }[];
};

function ts(m: MentionRecord): number {
  const raw = m.createdAt || m.scannedAt;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Newest posts per watched builder — the v0 “what are they doing” view. */
export function projectTimelines(
  mentions: MentionRecord[],
  perProject = 8,
): ProjectTimeline[] {
  return PROJECT_SEEDS.map((seed) => {
    const rows = mentions
      .filter((m) => !m.deletedAt)
      .filter(
        (m) => (m.author?.username ?? "").toLowerCase().replace(/^@/, "") === seed.handle,
      )
      .sort((a, b) => ts(b) - ts(a));
    const posts = rows.slice(0, perProject).map((m) => ({
      id: m.id,
      text: m.text,
      createdAt: m.createdAt,
      url: m.url,
    }));
    return {
      ...seed,
      lastPostedAt: rows[0]?.createdAt || rows[0]?.scannedAt,
      postCount: rows.length,
      posts,
    };
  });
}
