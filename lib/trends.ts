import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";
// Wrong pad (trends.fun / @trendsdotfun) — do not fetch.
// import { randomUUID } from "node:crypto";
// import { mapTrendsItem, type TrendsItem } from "./trends-map";

/**
 * Trends App (@trendsdotrun) — iOS SocialFi launchpad (Token Media).
 * Public coin catalog is not wired yet (App Store / trends.social coming soon).
 * Fail closed: empty rows, never invent mints or USD.
 */
export async function fetchTrendsTokens(opts?: {
  phase?: string;
}): Promise<TokenRow[]> {
  const phase = opts?.phase === "fast" ? "fast" : "full";
  return cachedPadFeed("trends", phase, async () => []);
}

// --- retired trends.fun ranking client ---
// const TRENDS_ORIGIN = "https://trends.fun";
// const TRENDS_API = "https://api.trends.fun";
// const MAX_PAGES = 5;
// async function loadTrendsTokens(): Promise<TokenRow[]> { ... ranking pagination ... }
