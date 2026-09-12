import type { TokenRow } from "./tokens";

const CLAW_ORIGIN = "https://clawpump.tech";

type ClawToken = {
  mintAddress?: string;
  name?: string | null;
  symbol?: string | null;
  imageUrl?: string | null;
  marketCap?: number | null;
  price?: number | null;
  volume24h?: number | null;
  liquidity?: number | null;
  isGraduated?: boolean | null;
  createdAt?: string | null;
};

function clawHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: CLAW_ORIGIN,
    Referer: `${CLAW_ORIGIN}/`,
    "User-Agent": "RWAScreener/1.0 (+clawpump live pad feed)",
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function absoluteIcon(image: string | undefined | null): string | null {
  if (!image || typeof image !== "string") return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("/")) return `${CLAW_ORIGIN}${image}`;
  return `${CLAW_ORIGIN}/${image}`;
}

function ageHoursFromIso(createdAt: string | null | undefined): number | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  const ms = Date.parse(createdAt);
  if (!Number.isFinite(ms)) return null;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, Math.round(hours));
}

function mapToken(t: ClawToken): TokenRow | null {
  const mint = typeof t.mintAddress === "string" ? t.mintAddress.trim() : "";
  if (!mint) return null;
  const mcap = numOrNull(t.marketCap);
  return {
    id: `clawpump-${mint}`,
    launchpadId: "clawpump",
    symbol: String(t.symbol || "").trim() || mint.slice(0, 6),
    name: String(t.name || "").trim() || String(t.symbol || "").trim() || mint.slice(0, 8),
    mint,
    icon: absoluteIcon(t.imageUrl),
    status: t.isGraduated ? "graduated" : "bonding",
    priceUsd: numOrNull(t.price),
    change24hPct: null,
    mcapUsd: mcap,
    fdvUsd: mcap,
    volume24hUsd: numOrNull(t.volume24h),
    liquidityUsd: numOrNull(t.liquidity),
    holders: null,
    holdersDelta24h: null,
    ageHours: ageHoursFromIso(t.createdAt),
    rangeLowUsd: null,
    rangeHighUsd: null,
    rangePos: null,
    spark24h: null,
    draft: false,
  };
}

async function fetchSort(sort: "trending" | "new"): Promise<ClawToken[]> {
  const res = await fetch(`${CLAW_ORIGIN}/api/tokens?sort=${sort}`, {
    headers: clawHeaders(),
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`ClawPump /api/tokens?sort=${sort} → HTTP ${res.status}`);
  }
  const data = (await res.json()) as { tokens?: ClawToken[] };
  return Array.isArray(data.tokens) ? data.tokens : [];
}

/**
 * Live ClawPump tokens from clawpump.tech.
 * Source: GET https://clawpump.tech/api/tokens?sort=trending|new
 * (union of both sorts; public list — no auth). Missing fields stay null.
 */
export async function fetchClawPumpTokens(): Promise<TokenRow[]> {
  const [trending, neu] = await Promise.all([
    fetchSort("trending"),
    fetchSort("new"),
  ]);

  const rows: TokenRow[] = [];
  const seen = new Set<string>();
  for (const raw of [...trending, ...neu]) {
    const row = mapToken(raw);
    if (!row || !row.mint || seen.has(row.mint)) continue;
    seen.add(row.mint);
    rows.push(row);
  }

  rows.sort((a, b) => {
    const av = a.volume24hUsd ?? -1;
    const bv = b.volume24hUsd ?? -1;
    if (bv !== av) return bv - av;
    return (b.mcapUsd ?? -1) - (a.mcapUsd ?? -1);
  });

  return rows;
}
