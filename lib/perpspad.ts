import type { TokenRow } from "./tokens";

const PERPSPAD_ORIGIN = "https://perpspad.fun";

/** Current deploy hash for the /tokens list serverFn (GET, no args). Redeploys may rotate it. */
const KNOWN_TOKENS_FN =
  "41cb24f2cd7bcae8032eb880b47efdb945f3fb94f126dc3c21b923b888cdcd6e";

type PerpspadToken = {
  id?: string;
  ticker?: string;
  name?: string;
  description?: string;
  imageUrl?: string | null;
  underlying?: string;
  leverage?: number;
  direction?: string;
  stockPaired?: boolean;
  terminalPool?: boolean;
  priceUsd?: number | null;
  changePct?: number | null;
  marketCap?: number | null;
  graduated?: boolean;
  graduationProgress?: number | null;
  createdAt?: string | null;
  mint?: string | null;
  externalMint?: string | null;
  source?: string | null;
  externalPlatform?: string | null;
};

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function ageHoursFrom(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;
  const ms = Date.parse(createdAt);
  if (!Number.isFinite(ms)) return null;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, Math.round(hours));
}

function absoluteIcon(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${PERPSPAD_ORIGIN}${url}`;
  return `${PERPSPAD_ORIGIN}/${url}`;
}

function resolveMint(t: PerpspadToken): string | null {
  const mint = typeof t.mint === "string" ? t.mint.trim() : "";
  if (mint) return mint;
  const ext = typeof t.externalMint === "string" ? t.externalMint.trim() : "";
  return ext || null;
}

/**
 * Minimal TanStack Start / seroval JSON decoder for the shapes Perpspad returns.
 * Types observed: 0 number, 1 string, 2 boolean (s:0|1|2), 3 null, 9 array, 10 object.
 */
function decodeSeroval(node: unknown, refs: Map<number, unknown> = new Map()): unknown {
  if (node == null || typeof node !== "object") return node;
  const n = node as Record<string, unknown>;
  if (typeof n.t !== "number") return node;

  const t = n.t as number;
  const i = typeof n.i === "number" ? n.i : undefined;
  if (i != null && refs.has(i)) return refs.get(i);

  if (t === 0 || t === 1) {
    const v = n.s;
    if (i != null) refs.set(i, v);
    return v;
  }
  if (t === 2) {
    const s = n.s;
    const v = s === 0 ? false : true;
    if (i != null) refs.set(i, v);
    return v;
  }
  if (t === 3) return null;

  if (t === 9) {
    const arr: unknown[] = [];
    if (i != null) refs.set(i, arr);
    const items = Array.isArray(n.a) ? n.a : [];
    for (const item of items) arr.push(decodeSeroval(item, refs));
    return arr;
  }

  if (t === 10) {
    const obj: Record<string, unknown> = {};
    if (i != null) refs.set(i, obj);
    const p = (n.p ?? {}) as { k?: string[]; v?: unknown[] };
    const keys = Array.isArray(p.k) ? p.k : [];
    const vals = Array.isArray(p.v) ? p.v : [];
    for (let idx = 0; idx < keys.length; idx++) {
      obj[keys[idx]] = decodeSeroval(vals[idx], refs);
    }
    return obj;
  }

  // Date / other: prefer string/number payload
  if ("s" in n) {
    if (i != null) refs.set(i, n.s);
    return n.s;
  }
  return node;
}

async function fetchServerFn(hash: string): Promise<unknown> {
  const res = await fetch(`${PERPSPAD_ORIGIN}/_serverFn/${hash}`, {
    headers: {
      Accept: "application/json, application/x-ndjson, text/x-script",
      "x-tsr-serverFn": "true",
      Origin: PERPSPAD_ORIGIN,
      Referer: `${PERPSPAD_ORIGIN}/tokens`,
      "User-Agent": "RWAScreener/1.0 (+perpspad live pad feed)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Perpspad _serverFn/${hash.slice(0, 12)}… → HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text) throw new Error(`Perpspad _serverFn/${hash.slice(0, 12)}… empty body`);
  return JSON.parse(text);
}

function tokensFromDecoded(decoded: unknown): PerpspadToken[] | null {
  if (!decoded || typeof decoded !== "object") return null;
  const root = decoded as Record<string, unknown>;
  const result = (root.result ?? root) as Record<string, unknown>;
  const tokens = result.tokens;
  if (!Array.isArray(tokens)) return null;
  return tokens as PerpspadToken[];
}

/** Scrape the live Vite index bundle for GET serverFn hashes (hash rotates on deploy). */
async function discoverTokensFnHashes(): Promise<string[]> {
  const page = await fetch(`${PERPSPAD_ORIGIN}/tokens`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "RWAScreener/1.0 (+perpspad live pad feed)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!page.ok) throw new Error(`Perpspad /tokens → HTTP ${page.status}`);
  const html = await page.text();
  const indexMatch = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  if (!indexMatch) throw new Error("Perpspad: no index bundle on /tokens");
  const indexUrl = `${PERPSPAD_ORIGIN}${indexMatch[0]}`;
  const jsRes = await fetch(indexUrl, {
    headers: { "User-Agent": "RWAScreener/1.0 (+perpspad live pad feed)" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!jsRes.ok) throw new Error(`Perpspad ${indexMatch[0]} → HTTP ${jsRes.status}`);
  const js = await jsRes.text();
  const hashes = [
    ...js.matchAll(/\{method:"GET"\}\)\.handler\([A-Za-z0-9_$]+\("([a-f0-9]{64})"\)\)/g),
  ].map((m) => m[1]);
  return [...new Set(hashes)];
}

async function loadRawTokens(): Promise<{ source: string; tokens: PerpspadToken[] }> {
  const tryHash = async (hash: string) => {
    const raw = await fetchServerFn(hash);
    const decoded = decodeSeroval(raw);
    const tokens = tokensFromDecoded(decoded);
    if (!tokens || tokens.length === 0) return null;
    // Sanity: real catalog rows have ticker + mint-ish fields
    const sample = tokens[0];
    if (!sample?.ticker && !sample?.name) return null;
    return tokens;
  };

  try {
    const tokens = await tryHash(KNOWN_TOKENS_FN);
    if (tokens) {
      return {
        source: `${PERPSPAD_ORIGIN}/_serverFn/${KNOWN_TOKENS_FN}`,
        tokens,
      };
    }
  } catch {
    // fall through to discovery
  }

  const hashes = await discoverTokensFnHashes();
  for (const hash of hashes) {
    if (hash === KNOWN_TOKENS_FN) continue;
    try {
      const tokens = await tryHash(hash);
      if (tokens) {
        return {
          source: `${PERPSPAD_ORIGIN}/_serverFn/${hash}`,
          tokens,
        };
      }
    } catch {
      // try next hash
    }
  }
  throw new Error("Perpspad: no tokens list serverFn responded with a catalog");
}

/**
 * Live Perpspad coin market as shown on perpspad.fun/tokens.
 * Source: TanStack Start GET `_serverFn/<hash>` (no public /api/launches).
 * Real fields: mint/externalMint, ticker, name, imageUrl, priceUsd, changePct,
 * marketCap, graduated, createdAt. No volume/liquidity/holders — left null.
 */
export async function fetchPerpspadTokens(): Promise<{
  source: string;
  tokens: TokenRow[];
}> {
  const { source, tokens: raw } = await loadRawTokens();
  const rows: TokenRow[] = [];
  const seen = new Set<string>();

  for (const t of raw) {
    const mint = resolveMint(t);
    if (!mint || seen.has(mint)) continue;
    seen.add(mint);
    const mcap = numOrNull(t.marketCap);
    const ticker = String(t.ticker || "").trim();
    const name = String(t.name || "").trim() || ticker || mint.slice(0, 8);
    rows.push({
      id: `perpspad-${mint}`,
      launchpadId: "perpspad",
      symbol: ticker || mint.slice(0, 6),
      name,
      mint,
      icon: absoluteIcon(t.imageUrl ?? null),
      status: t.graduated ? "graduated" : "bonding",
      priceUsd: numOrNull(t.priceUsd),
      change24hPct: numOrNull(t.changePct),
      mcapUsd: mcap,
      fdvUsd: mcap,
      volume24hUsd: null,
      liquidityUsd: null,
      holders: null,
      holdersDelta24h: null,
      ageHours: ageHoursFrom(t.createdAt ?? null),
      rangeLowUsd: null,
      rangeHighUsd: null,
      rangePos: null,
      spark24h: null,
      draft: false,
    });
  }

  rows.sort((a, b) => {
    const am = a.mcapUsd ?? -1;
    const bm = b.mcapUsd ?? -1;
    if (bm !== am) return bm - am;
    return (a.ageHours ?? 1e9) - (b.ageHours ?? 1e9);
  });

  return { source, tokens: rows };
}
