#!/usr/bin/env node
/**
 * Discover all on-chain Meteora DBC TokenBadge accounts via Helius gPA,
 * enrich with DAS getAssetBatch, categorize, rewrite data/quote-mints.json.
 *
 * Program-only — no Bags/pad APIs. Fail closed on Helius errors.
 */
import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import { fileURLToPath } from "node:url";
import { DBC_PROGRAM_ID } from "./constants.mjs";
import { loadDotEnv, ROOT } from "./env.mjs";
import { heliusRpc, mapPool, sleep } from "./helius.mjs";
import { loadQuoteMints } from "./quote-mints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(__dirname, "../../data/quote-mints.json");

/** TokenBadge account discriminator (bytemuck / Anchor). */
const TOKEN_BADGE_DISC = Buffer.from([116, 219, 204, 229, 249, 116, 255, 150]);
const TOKEN_BADGE_DISC_B58 = bs58.encode(TOKEN_BADGE_DISC);

/** Backed Finance xStocks mint authority (verified). */
export const BACKED_XSTOCKS_MINT_AUTHORITY =
  "S7vYFFWH6BjJyEsdrPQpqpYTqLTrPRK6KW3VwsJuRaS";

const BLOCKED_QUOTE_MINTS = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

/** Live on-chain mint authority observed for Backed xStock Token-2022 mints. */
export const XSTOCKS_LIVE_MINT_AUTHORITY =
  "7pt9tkctJPK7PPNQJ77GKg8ZffSF6QxoMiCFYHxrtaCj";

/** Ondo Global Markets mint authority cluster. */
export const ONDO_MINT_AUTHORITY =
  "9foMHsSDq7nMg4WPusSz9eY7tyxyukqborA8GyU5cUxD";

/** Known mint_authority → category overrides (extend as clusters stabilize). */
const AUTHORITY_CATEGORY = new Map([
  [BACKED_XSTOCKS_MINT_AUTHORITY, "xstocks"],
  [XSTOCKS_LIVE_MINT_AUTHORITY, "xstocks"],
  [ONDO_MINT_AUTHORITY, "ondo"],
]);

const CATEGORIES = new Set([
  "xstocks",
  "ondo",
  "commodities",
  "etfs",
  "backpack",
  "other",
]);

function discB58(buf) {
  return bs58.encode(buf);
}

function readPk(buf, offset) {
  return bs58.encode(buf.subarray(offset, offset + 32));
}

async function getProgramAccountsFiltered(apiKey, programId, filters, dataSlice) {
  const opts = { encoding: "base64", filters };
  if (dataSlice) opts.dataSlice = dataSlice;
  return heliusRpc(apiKey, "getProgramAccounts", [programId, opts]);
}

/**
 * gPA all TokenBadge accounts; decode token_mint at offset 8.
 * @returns {Promise<{ badge: string, mint: string }[]>}
 */
export async function fetchAllTokenBadges(apiKey, programId = DBC_PROGRAM_ID) {
  const rows = await getProgramAccountsFiltered(
    apiKey,
    programId,
    [{ memcmp: { offset: 0, bytes: TOKEN_BADGE_DISC_B58 } }],
    { offset: 0, length: 40 }, // 8 disc + 32 mint
  );
  if (!Array.isArray(rows)) {
    throw new Error("Helius getProgramAccounts TokenBadge: empty/non-array result");
  }
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const raw = row?.account?.data?.[0];
    if (!raw) continue;
    const data = Buffer.from(raw, "base64");
    if (data.length < 40) continue;
    const mint = readPk(data, 8);
    if (!mint || seen.has(mint) || BLOCKED_QUOTE_MINTS.has(mint)) continue;
    seen.add(mint);
    out.push({ badge: row.pubkey, mint });
  }
  return out;
}

/**
 * Batch DAS getAsset. Fail closed if any batch hard-errors after retries.
 * @returns {Promise<Map<string, object>>}
 */
export async function enrichMintsDas(apiKey, mints, { batchSize = 100, concurrency = 4 } = {}) {
  const batches = [];
  for (let i = 0; i < mints.length; i += batchSize) {
    batches.push(mints.slice(i, i + batchSize));
  }
  const byMint = new Map();
  await mapPool(batches, concurrency, async (ids) => {
    const result = await heliusRpc(apiKey, "getAssetBatch", { ids });
    if (!Array.isArray(result)) {
      throw new Error(`Helius getAssetBatch: expected array, got ${typeof result}`);
    }
    for (const asset of result) {
      if (!asset || asset === null) continue;
      const id = asset.id || asset.mint;
      if (typeof id === "string") byMint.set(id, asset);
    }
  });
  return byMint;
}

function pickSymbolName(asset) {
  const meta = asset?.content?.metadata || {};
  const tokenInfo = asset?.token_info || {};
  const symbol =
    (typeof tokenInfo.symbol === "string" && tokenInfo.symbol) ||
    (typeof meta.symbol === "string" && meta.symbol) ||
    "";
  const name =
    (typeof meta.name === "string" && meta.name) ||
    (typeof tokenInfo.name === "string" && tokenInfo.name) ||
    "";
  return { symbol: symbol.trim(), name: name.trim() };
}

function pickMintAuthority(asset) {
  const ti = asset?.token_info;
  if (typeof ti?.mint_authority === "string" && ti.mint_authority) {
    return ti.mint_authority;
  }
  // Some DAS payloads nest under authorities / mint_extensions
  const auths = asset?.authorities;
  if (Array.isArray(auths)) {
    for (const a of auths) {
      if (a?.scopes?.includes?.("mint") && typeof a.address === "string") {
        return a.address;
      }
    }
  }
  return null;
}

/**
 * Heuristic category from name/symbol (lowercase).
 */
function heuristicCategory(symbol, name) {
  const s = `${symbol} ${name}`.toLowerCase();
  if (
    /\bxstock\b/.test(s) ||
    /\bbacked\b/.test(s) ||
    /(^|\s)xstocks?(\s|$)/.test(s)
  ) {
    return "xstocks";
  }
  if (/\bondo\b/.test(s) || /\bondou?s\b/.test(s) || /ondo$/.test(symbol.toLowerCase())) {
    return "ondo";
  }
  if (/backpack/.test(s)) return "backpack";
  if (
    /\betf\b/.test(s) ||
    /\bexchange[\s-]?traded\b/.test(s) ||
    /\b(spy|qqq|iwm|dia|voo|vti)x?\b/.test(s)
  ) {
    return "etfs";
  }
  if (
    /\bcommodit/.test(s) ||
    /\b(gold|silver|crude|oil|copper|wheat|corn|nat[\s-]?gas|platinum|palladium|brent)\b/.test(
      s,
    )
  ) {
    return "commodities";
  }
  return null;
}

/**
 * Assign category: authority map → seed set → heuristics → authority cluster majority → other.
 */
export function assignCategories(rows) {
  // Pass 1: authority + seed + heuristics
  for (const row of rows) {
    const auth = row.meta?.mint_authority || null;
    if (auth && AUTHORITY_CATEGORY.has(auth)) {
      row.meta.category = AUTHORITY_CATEGORY.get(auth);
      continue;
    }
    if (row._seedCategory) {
      row.meta.category = row._seedCategory;
      continue;
    }
    const h = heuristicCategory(row.symbol, row.name);
    row.meta.category = h || "other";
  }

  // Pass 2: cluster by mint_authority — if majority non-other, apply to remaining other
  const clusters = new Map();
  for (const row of rows) {
    const auth = row.meta?.mint_authority;
    if (!auth) continue;
    if (!clusters.has(auth)) clusters.set(auth, []);
    clusters.get(auth).push(row);
  }
  for (const [, group] of clusters) {
    if (group.length < 2) continue;
    const counts = new Map();
    for (const r of group) {
      const c = r.meta.category;
      if (c === "other") continue;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    let best = null;
    let bestN = 0;
    for (const [c, n] of counts) {
      if (n > bestN) {
        best = c;
        bestN = n;
      }
    }
    if (!best || bestN < Math.ceil(group.length / 2)) continue;
    for (const r of group) {
      if (r.meta.category === "other") r.meta.category = best;
    }
    // Register learned authority mapping for this run
    if (!AUTHORITY_CATEGORY.has(group[0].meta.mint_authority)) {
      AUTHORITY_CATEGORY.set(group[0].meta.mint_authority, best);
    }
  }

  for (const row of rows) {
    if (!CATEGORIES.has(row.meta.category)) row.meta.category = "other";
    delete row._seedCategory;
  }
  return rows;
}

function categoryCounts(rows) {
  const counts = {};
  for (const r of rows) {
    const c = r.meta?.category || "other";
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
}

/**
 * Full discover → rewrite quote-mints.json.
 */
export async function discoverBadges(opts = {}) {
  loadDotEnv(opts.root || ROOT);
  const apiKey = (opts.apiKey || process.env.HELIUS_API_KEY || "").trim();
  if (!apiKey) {
    return {
      ok: false,
      reason: "HELIUS_API_KEY missing — fail closed",
      quote_mints: [],
      stats: {},
    };
  }

  const outPath = opts.outPath || DEFAULT_OUT;
  const programId = opts.programId || DBC_PROGRAM_ID;
  const nowIso = opts.nowIso || new Date().toISOString();

  // Prior allowlist (may already be expanded) — use for symbol/name fallback + prior category hints only.
  // Do NOT treat every listed mint as xstocks (that poisons re-runs after first expand).
  const seedRows = loadQuoteMints(outPath);
  const seedByMint = new Map(seedRows.map((r) => [r.mint, r]));

  let badges;
  try {
    badges = await fetchAllTokenBadges(apiKey, programId);
  } catch (e) {
    return {
      ok: false,
      reason: `TokenBadge gPA failed: ${e?.message || e}`,
      quote_mints: [],
      stats: {},
    };
  }

  const mints = badges.map((b) => b.mint);
  let assets;
  try {
    assets = await enrichMintsDas(apiKey, mints, {
      batchSize: opts.batchSize ?? 100,
      concurrency: opts.concurrency ?? 4,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `DAS getAssetBatch failed: ${e?.message || e}`,
      quote_mints: [],
      stats: { badgeCount: badges.length },
    };
  }

  // Soft-warn missing DAS rows but keep mint with seed/fallback metadata (still on-chain badge)
  let missingDas = 0;
  const rows = [];
  for (const { badge, mint } of badges) {
    const asset = assets.get(mint);
    const seed = seedByMint.get(mint);
    let symbol = "";
    let name = "";
    let mintAuthority = null;
    if (asset) {
      ({ symbol, name } = pickSymbolName(asset));
      mintAuthority = pickMintAuthority(asset);
    } else {
      missingDas += 1;
    }
    if (!symbol && seed?.symbol) symbol = seed.symbol;
    if (!name && seed?.name) name = seed.name;
    if (!mintAuthority && seed?.meta?.mint_authority) {
      mintAuthority = seed.meta.mint_authority;
    }

    // Fresh meta each run — do not copy prior issuer/category (re-run poison).
    const meta = {
      mint_authority: mintAuthority,
      token_badge: badge,
      source: "on-chain TokenBadge gPA",
    };

    const isXstocksAuth =
      mintAuthority === BACKED_XSTOCKS_MINT_AUTHORITY ||
      mintAuthority === XSTOCKS_LIVE_MINT_AUTHORITY;

    rows.push({
      mint,
      symbol: symbol || mint.slice(0, 6),
      name: name || symbol || mint.slice(0, 8),
      badge_verified_at: nowIso,
      meta,
      // Authority-only seed hint. Name heuristics + cluster fill the rest.
      _seedCategory: isXstocksAuth
        ? "xstocks"
        : mintAuthority === ONDO_MINT_AUTHORITY
          ? "ondo"
          : null,
    });
  }

  assignCategories(rows);

  const ISSUER_FOR = {
    xstocks: "Backed / xStocks",
    ondo: "Ondo",
    backpack: "Backpack Securities",
    commodities: "Commodities",
    etfs: "ETFs",
  };
  for (const row of rows) {
    const c = row.meta.category || "other";
    if (ISSUER_FOR[c]) row.meta.issuer = ISSUER_FOR[c];
    else delete row.meta.issuer;
  }

  // Stable sort: category then symbol then mint
  rows.sort(
    (a, b) =>
      String(a.meta.category).localeCompare(String(b.meta.category)) ||
      a.symbol.localeCompare(b.symbol) ||
      a.mint.localeCompare(b.mint),
  );

  const payload = {
    quote_mints: rows.map(({ mint, symbol, name, badge_verified_at, meta }) => ({
      mint,
      symbol,
      name,
      badge_verified_at,
      category: meta.category || "other",
      meta,
    })),
    fee_claimer_labels: {},
    notes: [
      "SoT = on-chain Meteora DBC TokenBadge gPA (program dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN) — not Bags/pad APIs",
      `Discovered ${rows.length} badged quote mint(s) at ${nowIso}; blocked SOL/USDC/USDT`,
      `Categories: xstocks (Backed ${BACKED_XSTOCKS_MINT_AUTHORITY} / live ${XSTOCKS_LIVE_MINT_AUTHORITY} or prior seed), ondo (${ONDO_MINT_AUTHORITY}), backpack / commodities / etfs via clusters + name heuristics, else other`,
      "fee_claimer_labels stay empty until observed on DBC PoolConfig for these quotes",
    ],
  };

  if (opts.write !== false) {
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }

  const counts = categoryCounts(payload.quote_mints);
  return {
    ok: true,
    reason: `TokenBadge discover complete — ${payload.quote_mints.length} mint(s)`,
    outPath,
    badgeCount: badges.length,
    written: payload.quote_mints.length,
    missingDas,
    categories: counts,
    quote_mints: payload.quote_mints,
    stats: {
      badgeCount: badges.length,
      written: payload.quote_mints.length,
      missingDas,
      categories: counts,
      verifiedAt: nowIso,
    },
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = await discoverBadges();
  const summary = {
    ok: result.ok,
    reason: result.reason,
    outPath: result.outPath,
    badgeCount: result.badgeCount,
    written: result.written,
    missingDas: result.missingDas,
    categories: result.categories,
    sample: (result.quote_mints || []).slice(0, 8).map((r) => ({
      mint: r.mint,
      symbol: r.symbol,
      category: r.meta?.category,
      mint_authority: r.meta?.mint_authority,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(result.ok ? 0 : 1);
}
