import type { TokenRow } from "./tokens";

const CLAW_ORIGIN = "https://clawpump.tech";
/** Max offset for snapshot pagination. Offset is ignored unless `snapshot` is pinned. */
const PAGE_SIZE = 200;
const MAX_OFFSET = 4000; // large window; full catalog ~14k is too slow for request path

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
  launchPlatform?: string | null;
};

type ClawListResponse = {
  tokens?: ClawToken[];
  total?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
  snapshot?: string | number;
};

function clawHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    Origin: CLAW_ORIGIN,
    Referer: `${CLAW_ORIGIN}/`,
    "User-Agent": "RWAScreener/1.0 (+clawpump meteora_dbc feed)",
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

async function fetchPage(
  offset: number,
  snapshot?: string,
): Promise<ClawListResponse> {
  const params = new URLSearchParams({
    sort: "new",
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  // Offset only applies when snapshot is pinned (otherwise API echoes offset:0).
  if (snapshot) params.set("snapshot", snapshot);
  const res = await fetch(`${CLAW_ORIGIN}/api/tokens?${params}`, {
    headers: clawHeaders(),
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    throw new Error(`ClawPump /api/tokens → HTTP ${res.status}`);
  }
  return (await res.json()) as ClawListResponse;
}

/**
 * Live ClawPump tokens launched on Meteora DBC only.
 *
 * Source: GET https://clawpump.tech/api/tokens?sort=new&limit=200&offset=&snapshot=
 * - Server-side launchPlatform filters are ignored — client filter only:
 *   keep launchPlatform === "meteora_dbc" (drop pump_fun / pons / …).
 * - Pagination requires pinning `snapshot` from the first page; bare offset is a no-op.
 * - Cap: offset ≤ 4000 (~20 pages). Full catalog ~14k is too slow for the request path;
 *   meteora_dbc density is low and clustered early in sort=new under current snapshots.
 */
export async function fetchClawPumpTokens(): Promise<TokenRow[]> {
  const first = await fetchPage(0);
  const snapshot =
    first.snapshot != null && first.snapshot !== ""
      ? String(first.snapshot)
      : undefined;
  if (!snapshot) {
    throw new Error("ClawPump response missing snapshot — cannot paginate");
  }

  const offsets: number[] = [];
  for (let off = PAGE_SIZE; off <= MAX_OFFSET; off += PAGE_SIZE) {
    offsets.push(off);
  }
  const rest = await Promise.all(offsets.map((off) => fetchPage(off, snapshot)));

  const rows: TokenRow[] = [];
  const seen = new Set<string>();
  for (const body of [first, ...rest]) {
    const tokens = Array.isArray(body.tokens) ? body.tokens : [];
    for (const raw of tokens) {
      if (raw?.launchPlatform !== "meteora_dbc") continue;
      const row = mapToken(raw);
      if (!row || !row.mint || seen.has(row.mint)) continue;
      seen.add(row.mint);
      rows.push(row);
    }
    if (body.hasMore === false) break;
  }

  rows.sort((a, b) => {
    const am = a.mcapUsd ?? -1;
    const bm = b.mcapUsd ?? -1;
    if (bm !== am) return bm - am;
    return (b.volume24hUsd ?? -1) - (a.volume24hUsd ?? -1);
  });

  return rows;
}
