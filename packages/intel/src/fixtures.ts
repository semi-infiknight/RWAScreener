import type { BucketId } from "./buckets.js";

export type DemoPost = {
  id: string;
  text: string;
  authorUsername: string;
  authorBio: string;
  /** Expected primary bucket(s) — semantic outcome, not embedding vectors */
  expectedPrimary: BucketId | BucketId[];
};

/**
 * Representative offline fixtures shared by CLI demo + automated tests.
 * Expectations are semantic outcomes (bucket ids), not embedding vectors.
 */
export const DEMO_POSTS: DemoPost[] = [
  {
    id: "demo-1",
    text: "Shipping our launchpad on Meteora DBC this week — PoolConfig + dynamic-bonding-curve-sdk CPI done, graduating to DAMM v2.",
    authorUsername: "pad_builder",
    authorBio: "Building Solana launch infra",
    expectedPrimary: ["builder_integrating_sdk", "pad_live_on_dbc"],
  },
  {
    id: "demo-2",
    text: "$MET to the moon 100x tonight buy the dip!!!",
    authorUsername: "degenxyz",
    authorBio: "calls only",
    expectedPrimary: "noise_retail_hype",
  },
  {
    id: "demo-3",
    text: "Anyone have experience integrating @MeteoraAG Dynamic Bonding Curve? Looking for partner config help for our launchpad.",
    authorUsername: "launch_founder",
    authorBio: "Founder @NewPad — Solana token launches",
    expectedPrimary: "pad_migrating_or_exploring",
  },
  {
    id: "demo-4",
    text: "Forked Fun Launch scaffold from Meteora Invent, customizing the trading UI for our niche RWA quote mint.",
    authorUsername: "rwa_dev",
    authorBio: "TS + Anchor",
    expectedPrimary: "scaffold_forker",
  },
];
