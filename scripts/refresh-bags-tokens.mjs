#!/usr/bin/env node
/**
 * Refresh Bags rows in data/tokens.json from the Bags public API.
 *
 * Source of truth for identity: GET /token-launch/feed (name/symbol/mint/status)
 * Graduation hint: GET /solana/bags/pools (dammV2PoolKey null => bonding, else graduated)
 * Feed status also maps: PRE_GRAD/MIGRATING/PRE_LAUNCH => bonding, MIGRATED => graduated
 *
 * Metrics (price/mcap/vol/spark/…) are intentionally omitted — never invented.
 *
 * Auth (optional):
 *   export BAGS_API_KEY=...
 *   or put BAGS_API_KEY=... in repo-root .env / .env.local
 * Feed + pools currently respond without a key; send x-api-key when present.
 *
 * Usage:
 *   node scripts/refresh-bags-tokens.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TOKENS_PATH = path.join(ROOT, "data", "tokens.json");
const BASE = "https://public-api-v2.bags.fm/api/v1";

/** Program IDs from https://docs.bags.fm/principles/program-ids (verified). */
export const BAGS_PROGRAM_IDS = {
  dbc: "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
  dammV2: "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
  feeShareV2: "FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK",
};

function loadDotEnv() {
  for (const name of [".env", ".env.local"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*BAGS_API_KEY\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v && !process.env.BAGS_API_KEY) process.env.BAGS_API_KEY = v;
    }
  }
}

function headers() {
  const h = { Accept: "application/json" };
  const key = process.env.BAGS_API_KEY?.trim();
  if (key) h["x-api-key"] = key;
  return h;
}

async function getJson(urlPath) {
  const res = await fetch(`${BASE}${urlPath}`, { headers: headers() });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${urlPath} → HTTP ${res.status}, non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok || body?.success === false) {
    throw new Error(
      `${urlPath} → HTTP ${res.status}: ${body?.error || text.slice(0, 200)}`,
    );
  }
  return body.response;
}

function mapStatus(feedStatus, dammV2PoolKey) {
  if (dammV2PoolKey) return "graduated";
  if (feedStatus === "MIGRATED") return "graduated";
  return "bonding";
}

function bagsRow(item, pool) {
  const mint = item.tokenMint;
  const status = mapStatus(item.status, pool?.dammV2PoolKey ?? null);
  return {
    id: `bags-${mint}`,
    launchpadId: "bags",
    symbol: String(item.symbol || "").trim() || mint.slice(0, 6),
    name: String(item.name || "").trim() || item.symbol || mint.slice(0, 8),
    mint,
    status,
    // Identity is real from Bags API; metrics intentionally absent (not invented).
    priceUsd: null,
    change24hPct: null,
    mcapUsd: null,
    fdvUsd: null,
    volume24hUsd: null,
    liquidityUsd: null,
    holders: null,
    holdersDelta24h: null,
    ageHours: null,
    rangeLowUsd: null,
    rangeHighUsd: null,
    rangePos: null,
    spark24h: null,
    draft: false,
  };
}

async function main() {
  loadDotEnv();
  const hasKey = Boolean(process.env.BAGS_API_KEY?.trim());
  console.log(
    `Bags refresh — API key ${hasKey ? "present" : "absent (public feed/pools)"}`,
  );
  console.log("Program IDs:", BAGS_PROGRAM_IDS);

  const [feed, pools] = await Promise.all([
    getJson("/token-launch/feed"),
    getJson("/solana/bags/pools"),
  ]);

  if (!Array.isArray(feed) || feed.length === 0) {
    throw new Error("token-launch/feed returned no items");
  }

  const poolByMint = new Map();
  if (Array.isArray(pools)) {
    for (const p of pools) {
      if (p?.tokenMint) poolByMint.set(p.tokenMint, p);
    }
  }

  const seen = new Set();
  const bagsTokens = [];
  for (const item of feed) {
    if (!item?.tokenMint) continue;
    if (item.status === "PRE_LAUNCH") continue;
    if (seen.has(item.tokenMint)) continue;
    seen.add(item.tokenMint);
    bagsTokens.push(bagsRow(item, poolByMint.get(item.tokenMint)));
  }

  const existing = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
  const others = (existing.tokens || []).filter((t) => t.launchpadId !== "bags");
  const today = new Date().toISOString().slice(0, 10);

  const next = {
    updatedAt: today,
    disclaimer:
      "Bags rows: real mints from Bags public API (GET /token-launch/feed + /solana/bags/pools; docs.bags.fm). Metrics null until priced — never invented. Other launchpads may still be draft frontend seeds. Not endorsements.",
    tokens: [...others, ...bagsTokens],
  };

  fs.writeFileSync(TOKENS_PATH, JSON.stringify(next, null, 2) + "\n");
  const bonding = bagsTokens.filter((t) => t.status === "bonding").length;
  const graduated = bagsTokens.filter((t) => t.status === "graduated").length;
  console.log(
    `Wrote ${bagsTokens.length} Bags tokens (${bonding} bonding, ${graduated} graduated); kept ${others.length} non-Bags rows → ${TOKENS_PATH}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
