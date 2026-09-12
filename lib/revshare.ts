import type { TokenRow } from "./tokens";
import { cachedPadFeed } from "./pad-cache";

const REVSHARE_ORIGIN = "https://app.revshare.ltd";
const PAGE_LIMIT = 100;
/** Cap pagination for request-path latency (~500–1000 Solana rows). */
const MAX_PAGES = 10;

/** Named non-Meteora factories / launchlabs seen on Solana rows. */
const NON_METEORA_CONFIGS = new Set([
  "PUMPFUN",
  "raydium-launchlab",
]);

/** Meteora DBC config keys are base58 pubkeys (not named factories). */
const BASE58_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type RevShareToken = {
  mintAddress?: string;
  tokenName?: string | null;
  tokenSymbol?: string | null;
  tokenLogo?: string | null;
  dateCreated?: string | null;
  status?: number | null;
  bonding_curve?: number | null;
  migrated?: number | boolean | null;
  bonding_config?: string | null;
  chain?: number | null;
  chainId?: number | null;
  marketCap?: number | null;
};

type RevShareListResponse = {
  tokens?: RevShareToken[];
  pagination?: {
    limit?: number;
    order?: string;
    has_more?: boolean;
    next_cursor?: number | string | null;
    chain_id?: number | null;
  };
};

/** Dexscreener-style pair from /api/projects (graduated / listed). */
type RevShareProject = {
  chainId?: string;
  marketCap?: number | null;
  fdv?: number | null;
  priceUsd?: string | number | null;
  volume?: { h24?: number | null } | null;
  liquidity?: { usd?: number | null } | null;
  priceChange?: { h24?: number | null } | null;
  baseToken?: { address?: string; name?: string; symbol?: string } | null;
};

type RevShareTrending = {
  chain?: string;
  mint_address?: string;
  marketCap?: number | null;
  volume_h24?: number | null;
  liquidity?: number | null;
  priceUsd?: number | null;
  priceChange?: number | null;
  token_name?: string | null;
  token_image?: string | null;
};

type MintMetrics = {
  mcapUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  priceUsd: number | null;
  change24hPct: number | null;
};

function revshareHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: REVSHARE_ORIGIN,
    Referer: `${REVSHARE_ORIGIN}/all-tokens`,
    "User-Agent": "RWAScreener/1.0 (+revshare meteora_dbc feed)",
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    return null;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

/** Treat placeholder zeros as missing — all-tokens often ships marketCap:0. */
function positiveOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  if (n == null || n === 0) return null;
  return n;
}

function absoluteIcon(image: string | undefined | null): string | null {
  if (!image || typeof image !== "string") return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("/")) return `${REVSHARE_ORIGIN}${image}`;
  return `https://images.revshare.dev/${image}`;
}

function ageHoursFromDate(createdAt: string | null | undefined): number | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  // API ships "YYYY-MM-DD HH:MM:SS" (UTC-ish) — coerce to ISO for Date.parse.
  const iso = createdAt.includes("T")
    ? createdAt
    : createdAt.replace(" ", "T") + "Z";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    const ms2 = Date.parse(createdAt);
    if (!Number.isFinite(ms2)) return null;
    const hours = (Date.now() - ms2) / 3_600_000;
    if (!Number.isFinite(hours) || hours < 0) return null;
    return Math.max(0, hours);
  }
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, hours);
}

/**
 * Solana Meteora DBC rows only:
 * - chain_id=0 on the API request (Solana)
 * - bonding_config is a base58 pubkey (Meteora config key)
 * - exclude named factories (PUMPFUN, raydium-launchlab, *_V3 / *_V4)
 */
export function isMeteoraDbcConfig(cfg: unknown): boolean {
  if (cfg == null) return false;
  const s = String(cfg).trim();
  if (!s || s === "None" || s === "null") return false;
  if (NON_METEORA_CONFIGS.has(s)) return false;
  if (s.endsWith("_V3") || s.endsWith("_V4")) return false;
  if (s.startsWith("ROBINHOOD") || s.startsWith("BNB_") || s.startsWith("MONAD")) {
    return false;
  }
  if (s.toLowerCase().startsWith("raydium")) return false;
  return BASE58_PUBKEY.test(s);
}

function isGraduated(t: RevShareToken): boolean {
  if (t.migrated === true || t.migrated === 1) return true;
  return false;
}

function mapToken(
  t: RevShareToken,
  enrich: MintMetrics | undefined,
): TokenRow | null {
  const mint = typeof t.mintAddress === "string" ? t.mintAddress.trim() : "";
  if (!mint) return null;
  // Solana mints are base58, not 0x…
  if (mint.startsWith("0x") || mint.startsWith("0X")) return null;
  // Prefer projects/trending (real numbers); all-tokens marketCap is often 0.
  const listMcap = positiveOrNull(t.marketCap);
  const mcap = enrich?.mcapUsd ?? listMcap;
  const fdv = enrich?.fdvUsd ?? mcap;
  return {
    id: `revshare-${mint}`,
    launchpadId: "revshare",
    symbol: String(t.tokenSymbol || "").trim() || mint.slice(0, 6),
    name:
      String(t.tokenName || "").trim() ||
      String(t.tokenSymbol || "").trim() ||
      mint.slice(0, 8),
    mint,
    icon: absoluteIcon(t.tokenLogo),
    status: isGraduated(t) ? "graduated" : "bonding",
    priceUsd: enrich?.priceUsd ?? null,
    change24hPct: enrich?.change24hPct ?? null,
    mcapUsd: mcap,
    fdvUsd: fdv,
    volume24hUsd: enrich?.volume24hUsd ?? null,
    liquidityUsd: enrich?.liquidityUsd ?? null,
    holders: null,
    holdersDelta24h: null,
    ageHours: ageHoursFromDate(t.dateCreated),
    rangeLowUsd: null,
    rangeHighUsd: null,
    rangePos: null,
    spark24h: null,
    draft: false,
  };
}

async function fetchPage(cursor?: number | string | null): Promise<RevShareListResponse> {
  const params = new URLSearchParams({
    limit: String(PAGE_LIMIT),
    order: "newest",
    chain_id: "0",
  });
  if (cursor != null && cursor !== "") {
    params.set("cursor", String(cursor));
  }
  const res = await fetch(`${REVSHARE_ORIGIN}/api/all-tokens?${params}`, {
    headers: revshareHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`RevShare /api/all-tokens → HTTP ${res.status}`);
  }
  return (await res.json()) as RevShareListResponse;
}

/**
 * Batch market metrics from public RevShare endpoints that actually price tokens.
 * /api/all-tokens leaves marketCap at 0 for bonding rows; projects + trending fill gaps.
 */
async function fetchMintMetrics(): Promise<Map<string, MintMetrics>> {
  const out = new Map<string, MintMetrics>();

  const merge = (mint: string, patch: Partial<MintMetrics>) => {
    const cur = out.get(mint) ?? {
      mcapUsd: null,
      fdvUsd: null,
      volume24hUsd: null,
      liquidityUsd: null,
      priceUsd: null,
      change24hPct: null,
    };
    out.set(mint, {
      mcapUsd: patch.mcapUsd ?? cur.mcapUsd,
      fdvUsd: patch.fdvUsd ?? cur.fdvUsd,
      volume24hUsd: patch.volume24hUsd ?? cur.volume24hUsd,
      liquidityUsd: patch.liquidityUsd ?? cur.liquidityUsd,
      priceUsd: patch.priceUsd ?? cur.priceUsd,
      change24hPct: patch.change24hPct ?? cur.change24hPct,
    });
  };

  const [projectsRes, trendingRes] = await Promise.allSettled([
    fetch(`${REVSHARE_ORIGIN}/api/projects`, {
      headers: revshareHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(`${REVSHARE_ORIGIN}/api/trending-tokens`, {
      headers: revshareHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }),
  ]);

  if (projectsRes.status === "fulfilled" && projectsRes.value.ok) {
    try {
      const body = (await projectsRes.value.json()) as {
        projects?: RevShareProject[];
      };
      for (const p of Array.isArray(body.projects) ? body.projects : []) {
        if (p.chainId && p.chainId !== "solana") continue;
        const mint =
          typeof p.baseToken?.address === "string"
            ? p.baseToken.address.trim()
            : "";
        if (!mint) continue;
        const mcap = positiveOrNull(p.marketCap) ?? positiveOrNull(p.fdv);
        merge(mint, {
          mcapUsd: mcap,
          fdvUsd: positiveOrNull(p.fdv) ?? mcap,
          volume24hUsd: positiveOrNull(p.volume?.h24),
          liquidityUsd: positiveOrNull(p.liquidity?.usd),
          priceUsd: positiveOrNull(p.priceUsd),
          change24hPct: numOrNull(p.priceChange?.h24),
        });
      }
    } catch {
      // keep empty — list rows still usable
    }
  }

  if (trendingRes.status === "fulfilled" && trendingRes.value.ok) {
    try {
      const body = (await trendingRes.value.json()) as {
        trending_tokens?: RevShareTrending[];
      };
      for (const t of Array.isArray(body.trending_tokens)
        ? body.trending_tokens
        : []) {
        if (t.chain && t.chain !== "solana") continue;
        const mint =
          typeof t.mint_address === "string" ? t.mint_address.trim() : "";
        if (!mint) continue;
        // Trending often has fresher volume/liq — prefer non-null trending fields.
        const cur = out.get(mint);
        merge(mint, {
          mcapUsd: positiveOrNull(t.marketCap) ?? cur?.mcapUsd ?? null,
          fdvUsd: positiveOrNull(t.marketCap) ?? cur?.fdvUsd ?? null,
          volume24hUsd:
            positiveOrNull(t.volume_h24) ?? cur?.volume24hUsd ?? null,
          liquidityUsd:
            positiveOrNull(t.liquidity) ?? cur?.liquidityUsd ?? null,
          priceUsd: positiveOrNull(t.priceUsd) ?? cur?.priceUsd ?? null,
          change24hPct: numOrNull(t.priceChange) ?? cur?.change24hPct ?? null,
        });
      }
    } catch {
      // projects alone still useful
    }
  }

  return out;
}

/**
 * Live RevShare Solana Meteora DBC launches.
 *
 * Source: GET https://app.revshare.ltd/api/all-tokens?limit=100&order=newest&chain_id=0
 *         (+ cursor pagination via pagination.next_cursor / has_more)
 * Metrics: merge /api/projects + /api/trending-tokens (all-tokens marketCap is often 0).
 * Filter: bonding_config is base58 pubkey (Meteora DBC config); drop PUMPFUN /
 *         raydium-launchlab / *_V3/_V4 / null.
 * Cap: MAX_PAGES (10) for request-path latency.
 */
export async function fetchRevShareTokens(opts?: {
  phase?: string;
}): Promise<TokenRow[]> {
  const phase = opts?.phase === "fast" ? "fast" : "full";
  return cachedPadFeed("revshare", phase, () => loadRevShareTokens());
}

async function loadRevShareTokens(): Promise<TokenRow[]> {
  try {
    const [metrics, firstPage] = await Promise.all([
      fetchMintMetrics().catch(() => new Map<string, MintMetrics>()),
      fetchPage(undefined),
    ]);

    const rows: TokenRow[] = [];
    const seen = new Set<string>();
    let cursor: number | string | null | undefined = undefined;
    let pages = 0;
    let body: RevShareListResponse = firstPage;

    while (pages < MAX_PAGES) {
      if (pages > 0) body = await fetchPage(cursor);
      const tokens = Array.isArray(body.tokens) ? body.tokens : [];
      for (const raw of tokens) {
        if (!isMeteoraDbcConfig(raw?.bonding_config)) continue;
        const mint =
          typeof raw?.mintAddress === "string" ? raw.mintAddress.trim() : "";
        const row = mapToken(raw, mint ? metrics.get(mint) : undefined);
        if (!row || !row.mint || seen.has(row.mint)) continue;
        seen.add(row.mint);
        rows.push(row);
      }
      pages += 1;
      const pag = body.pagination;
      if (!pag?.has_more || pag.next_cursor == null || tokens.length === 0) {
        break;
      }
      cursor = pag.next_cursor;
    }

    rows.sort((a, b) => {
      const am = a.mcapUsd ?? -1;
      const bm = b.mcapUsd ?? -1;
      if (bm !== am) return bm - am;
      const aa = a.ageHours ?? Number.POSITIVE_INFINITY;
      const ba = b.ageHours ?? Number.POSITIVE_INFINITY;
      return aa - ba;
    });

    return rows;
  } catch (err) {
    console.error("[revshare] fetchRevShareTokens failed", err);
    return [];
  }
}
