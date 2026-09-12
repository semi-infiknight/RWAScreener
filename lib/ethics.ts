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

/**
 * Live Ethics launches as shown on ethics.ltd.
 * Identity: GET /api/launches
 * Metrics: GET /api/launches/board + POST /api/launches/enrich
 * Missing metrics stay null — never invented.
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
    // Board metrics alone are still prod data; enrich is best-effort.
  }

  const rows: TokenRow[] = [];
  const seen = new Set<string>();
  for (const l of launches) {
    if (!l?.mint || seen.has(l.mint)) continue;
    seen.add(l.mint);
    rows.push({
      id: `ethics-${l.mint}`,
      launchpadId: "ethics",
      symbol: String(l.symbol || "").trim() || l.mint.slice(0, 6),
      name: String(l.name || "").trim() || l.symbol || l.mint.slice(0, 8),
      mint: l.mint,
      status: mapStatus(l.launchPath),
      priceUsd: null,
      change24hPct: null,
      mcapUsd: numOrNull(mcaps[l.mint]),
      fdvUsd: numOrNull(mcaps[l.mint]),
      volume24hUsd: numOrNull(volumes[l.mint]),
      liquidityUsd: null,
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

  // Rank by volume then mcap (missing sink)
  rows.sort((a, b) => {
    const av = a.volume24hUsd ?? -1;
    const bv = b.volume24hUsd ?? -1;
    if (bv !== av) return bv - av;
    return (b.mcapUsd ?? -1) - (a.mcapUsd ?? -1);
  });

  return rows;
}
