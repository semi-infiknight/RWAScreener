import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";

const EMBER_ORIGIN = "https://embercurve.fun";

type EmberMarket = {
  mint?: string;
  name?: string;
  symbol?: string;
  image?: string;
  pool?: string;
  dammPool?: string;
  graduated?: boolean;
  /** Ember-flagged junk / spoofed pricing — skip from screener. */
  suspect?: boolean;
  progress?: number;
  quoteReserve?: number;
  /** USD price of the quote mint (for reserve→USD). */
  quoteUsd?: number;
  priceUsd?: number;
  change24h?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  holders?: number;
  createdAt?: number;
  spark?: number[];
  live?: boolean;
};

function emberHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: EMBER_ORIGIN,
    Referer: `${EMBER_ORIGIN}/cooking`,
    "User-Agent": "RWAScreener/1.0 (+embercurve live pad feed)",
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

/** Quote-side USD in pool: quoteReserve (human) × quoteUsd. Honest liq proxy. */
function liquidityFromMarket(m: EmberMarket): number | null {
  const reserve = numOrNull(m.quoteReserve);
  const quoteUsd = numOrNull(m.quoteUsd);
  if (reserve == null || quoteUsd == null || reserve < 0 || quoteUsd < 0) {
    return null;
  }
  const liq = reserve * quoteUsd;
  if (!Number.isFinite(liq) || liq <= 0) return null;
  return liq;
}

function absoluteIcon(image: string | undefined | null): string | null {
  if (!image || typeof image !== "string") return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("/")) return `${EMBER_ORIGIN}${image}`;
  return `${EMBER_ORIGIN}/${image}`;
}

function ageHoursFrom(createdAt: number | undefined): number | null {
  if (createdAt == null || !Number.isFinite(createdAt)) return null;
  const ms = createdAt > 1e12 ? createdAt : createdAt * 1000;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, hours);
}

/**
 * Live Ember Curve markets as shown on embercurve.fun/cooking.
 * Source: GET https://embercurve.fun/api/solana/markets
 * Status SoT: `graduated` boolean (dammPool set iff graduated).
 * Skip `suspect: true` — Ember flags empty/spoofed pools (e.g. AR/CLANKER ~$75M FDV).
 * Missing fields stay null. No invented metrics.
 */
export async function fetchEmberCurveTokens(opts?: {
  phase?: string;
}): Promise<TokenRow[]> {
  const phase = opts?.phase === "fast" ? "fast" : "full";
  return cachedPadFeed("embercurve", phase, () => loadEmberCurveTokens());
}

async function loadEmberCurveTokens(): Promise<TokenRow[]> {
  const res = await fetch(`${EMBER_ORIGIN}/api/solana/markets`, {
    headers: emberHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Ember /api/solana/markets → HTTP ${res.status}`);
  }
  const data = (await res.json()) as { markets?: EmberMarket[] };
  const markets = Array.isArray(data.markets) ? data.markets : [];
  // Empty body is failure (do not treat as real coins:0 for homepage).
  if (markets.length === 0) {
    throw new Error("Ember /api/solana/markets → empty markets");
  }

  const rows: TokenRow[] = [];
  const seen = new Set<string>();
  for (const m of markets) {
    if (!m?.mint || seen.has(m.mint)) continue;
    // Ember marks spoofed / empty-curve rows (fake mega mcap, progress≈0).
    if (m.suspect === true) continue;
    seen.add(m.mint);
    const mcap = numOrNull(m.marketCapUsd);
    rows.push({
      id: `embercurve-${m.mint}`,
      launchpadId: "embercurve",
      symbol: String(m.symbol || "").trim() || m.mint.slice(0, 6),
      name: String(m.name || "").trim() || m.symbol || m.mint.slice(0, 8),
      mint: m.mint,
      icon: absoluteIcon(m.image),
      // SoT: Ember `graduated` (true ⇒ dammPool set). Do not infer from mcap.
      status: m.graduated ? "graduated" : "bonding",
      priceUsd: numOrNull(m.priceUsd),
      change24hPct: numOrNull(m.change24h),
      mcapUsd: mcap,
      fdvUsd: mcap,
      volume24hUsd: numOrNull(m.volume24hUsd),
      liquidityUsd: liquidityFromMarket(m),
      holders: numOrNull(m.holders),
      holdersDelta24h: null,
      ageHours: ageHoursFrom(m.createdAt),
      rangeLowUsd: null,
      rangeHighUsd: null,
      rangePos: null,
      // Ember `spark` is not a clean price series — leave null.
      spark24h: null,
      draft: false,
    });
  }

  rows.sort((a, b) => {
    const av = a.volume24hUsd ?? -1;
    const bv = b.volume24hUsd ?? -1;
    if (bv !== av) return bv - av;
    return (b.mcapUsd ?? -1) - (a.mcapUsd ?? -1);
  });

  return rows;
}
