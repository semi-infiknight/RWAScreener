/**
 * Launchpad platform-token allowlist + Jupiter mcap.
 * Fail closed: unknown pads and unverified mints are omitted, never invented.
 */
import seed from "../data/platform-tokens.json";
import { cachedByKey, peekByKey } from "./pad-cache";
import {
  mcapFromJupiterToken,
  parsePlatformTokenSeed,
  type PlatformTokenMap,
  type PlatformTokenRow,
  type PlatformTokenSeed,
} from "./platform-tokens-map";
import { projects } from "./projects";

const JUPITER_UA = "meteora.fyi-platform-tokens/1.0";
const CACHE_KEY = "pad:platform-tokens:v2";

export type { PlatformTokenMap, PlatformTokenRow, PlatformTokenSeed };

export function knownLaunchpadIds(
  list: { id: string }[] = projects,
): Set<string> {
  return new Set(list.map((p) => p.id));
}

export function platformTokenAllowlist(): PlatformTokenSeed[] {
  return parsePlatformTokenSeed(seed, knownLaunchpadIds());
}

async function fetchJupiterMcap(mint: string): Promise<number | null> {
  const url = `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8_000);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": JUPITER_UA,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body: unknown = await res.json().catch(() => null);
    return mcapFromJupiterToken(body, mint);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadPlatformTokenRows(): Promise<PlatformTokenMap> {
  const seeds = platformTokenAllowlist();
  const pairs = await Promise.all(
    seeds.map(async (s) => {
      const mcapUsd = await fetchJupiterMcap(s.mint);
      const row: PlatformTokenRow = {
        launchpadId: s.launchpadId,
        symbol: s.symbol,
        mint: s.mint,
        mcapUsd,
      };
      return [s.launchpadId, row] as const;
    }),
  );
  return Object.fromEntries(pairs);
}

export async function loadPlatformTokensCached(): Promise<PlatformTokenMap> {
  return cachedByKey(CACHE_KEY, loadPlatformTokenRows, {
    shouldCache: (value) => Object.keys(value).length > 0,
  });
}

export async function peekHomePlatformTokens(): Promise<PlatformTokenMap> {
  return (await peekByKey<PlatformTokenMap>(CACHE_KEY)) ?? {};
}
