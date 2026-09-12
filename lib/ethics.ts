import type { TokenRow } from "./tokens";

const ETHICS_ORIGIN = "https://www.ethics.ltd";

type EthicsLaunch = {
  mint: string;
  name?: string;
  symbol?: string;
  launchPath?: string;
  createdAt?: number;
  quoteId?: string;
  poolAddress?: string;
  icon?: string;
};

type BoardPayload = {
  launches?: EthicsLaunch[];
  mcaps?: Record<string, number>;
  volumes?: Record<string, number>;
};

type TokenInfoEnrich = {
  usdPrice?: number | null;
  mcap?: number | null;
  fdv?: number | null;
  liquidity?: number | null;
  volume24h?: number | null;
  change24h?: number | null;
  icon?: string | null;
};

function ethicsHeaders(extra?: HeadersInit): HeadersInit {
  return {
    Accept: "application/json",
    Origin: ETHICS_ORIGIN,
    Referer: `${ETHICS_ORIGIN}/launches`,
    "User-Agent": "RWAScreener/1.0 (+ethics live pad feed)",
    ...extra,
  };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ETHICS_ORIGIN}${path}`, {
    headers: ethicsHeaders(),
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`Ethics ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ETHICS_ORIGIN}${path}`, {
    method: "POST",
    headers: ethicsHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Ethics POST ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function mapStatus(launchPath: string | undefined): TokenRow["status"] {
  if (launchPath === "dbc") return "bonding";
  return "graduated";
}

function ageHoursFrom(createdAt: number | undefined): number | null {
  if (createdAt == null || !Number.isFinite(createdAt)) return null;
  const ms = createdAt > 1e12 ? createdAt : createdAt * 1000;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, Math.round(hours));
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function fetchTokenInfo(mint: string): Promise<TokenInfoEnrich | null> {
  try {
    const res = await fetch(
      `${ETHICS_ORIGIN}/api/launches/token-info?mint=${encodeURIComponent(mint)}`,
      { headers: ethicsHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      pools?: Array<{
        volume24h?: number;
        liquidity?: number;
        baseAsset?: {
          usdPrice?: number;
          mcap?: number;
          fdv?: number;
          liquidity?: number;
          icon?: string;
          stats24h?: { priceChange?: number };
        };
      }>;
    };
    const pool = data.pools?.[0];
    if (!pool) return null;
    const b = pool.baseAsset ?? {};
    return {
      usdPrice: numOrNull(b.usdPrice),
      mcap: numOrNull(b.mcap),
      fdv: numOrNull(b.fdv),
      liquidity: numOrNull(b.liquidity ?? pool.liquidity),
      volume24h: numOrNull(pool.volume24h),
      change24h: numOrNull(b.stats24h?.priceChange),
      icon: typeof b.icon === "string" ? b.icon : null,
    };
  } catch {
    return null;
  }
}

/**
 * Live Ethics launches as shown on ethics.ltd.
 * Identity + icons: GET /api/launches
 * Board mcap/vol: GET /api/launches/board + POST enrich
 * Price / % / liq: GET /api/launches/token-info?mint=… (concurrent; missing stay null)
 * Spark/range/holders: not on these public endpoints — stay null.
 */
export async function fetchEthicsTokens(): Promise<TokenRow[]> {
  const [all, board] = await Promise.all([
    getJson<{ launches?: EthicsLaunch[] }>("/api/launches"),
    getJson<BoardPayload>("/api/launches/board"),
  ]);

  const launches = Array.isArray(all.launches) ? all.launches : [];
  if (launches.length === 0) return [];

  const mcaps: Record<string, number> = { ...(board.mcaps ?? {}) };
  const volumes: Record<string, number> = { ...(board.volumes ?? {}) };

  const mints = [
    ...new Set(launches.map((l) => l.mint).filter(Boolean)),
  ] as string[];

  try {
    const enriched = await postJson<{
      mcaps?: Record<string, number>;
      volumes?: Record<string, number>;
    }>("/api/launches/enrich", { mints });
    Object.assign(mcaps, enriched.mcaps ?? {});
    Object.assign(volumes, enriched.volumes ?? {});
  } catch {
    // board metrics alone still prod
  }

  // Prefer enriching board + high-volume mints first, then the rest.
  const boardSet = new Set((board.launches ?? []).map((l) => l.mint));
  const ordered = [
    ...mints.filter((m) => boardSet.has(m)),
    ...mints.filter((m) => !boardSet.has(m)),
  ];

  const detailsList = await mapPool(ordered, 10, fetchTokenInfo);
  const details = new Map<string, TokenInfoEnrich | null>();
  ordered.forEach((m, i) => details.set(m, detailsList[i] ?? null));

  const rows: TokenRow[] = [];
  const seen = new Set<string>();
  for (const l of launches) {
    if (!l?.mint || seen.has(l.mint)) continue;
    seen.add(l.mint);
    const d = details.get(l.mint);
    const mcap =
      numOrNull(d?.mcap) ?? numOrNull(mcaps[l.mint]);
    const fdv = numOrNull(d?.fdv) ?? mcap;
    const vol =
      numOrNull(d?.volume24h) ?? numOrNull(volumes[l.mint]);
    rows.push({
      id: `ethics-${l.mint}`,
      launchpadId: "ethics",
      symbol: String(l.symbol || "").trim() || l.mint.slice(0, 6),
      name: String(l.name || "").trim() || l.symbol || l.mint.slice(0, 8),
      mint: l.mint,
      icon: d?.icon || l.icon || null,
      status: mapStatus(l.launchPath),
      priceUsd: numOrNull(d?.usdPrice),
      change24hPct: numOrNull(d?.change24h),
      mcapUsd: mcap,
      fdvUsd: fdv,
      volume24hUsd: vol,
      liquidityUsd: numOrNull(d?.liquidity),
      holders: null,
      holdersDelta24h: null,
      ageHours: ageHoursFrom(l.createdAt),
      rangeLowUsd: null,
      rangeHighUsd: null,
      rangePos: null,
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
