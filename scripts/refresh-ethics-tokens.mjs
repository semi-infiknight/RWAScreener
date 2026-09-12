#!/usr/bin/env node
/**
 * Optional: snapshot Ethics board into data/tokens.json (identity + mcap/vol).
 * Prefer live fetch via lib/ethics.ts in the app. Never invents missing metrics.
 *
 *   node scripts/refresh-ethics-tokens.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_PATH = path.join(ROOT, "data", "tokens.json");
const ORIGIN = "https://www.ethics.ltd";

const headers = {
  Accept: "application/json",
  Origin: ORIGIN,
  Referer: `${ORIGIN}/launches`,
  "User-Agent": "RWAScreener/1.0",
};

async function getJson(p) {
  const res = await fetch(`${ORIGIN}${p}`, { headers });
  if (!res.ok) throw new Error(`${p} HTTP ${res.status}`);
  return res.json();
}

async function postJson(p, body) {
  const res = await fetch(`${ORIGIN}${p}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${p} HTTP ${res.status}`);
  return res.json();
}

function ageHours(createdAt) {
  if (createdAt == null) return null;
  const ms = createdAt > 1e12 ? createdAt : createdAt * 1000;
  const h = (Date.now() - ms) / 3_600_000;
  return Number.isFinite(h) && h >= 0 ? Math.round(h) : null;
}

const [all, board] = await Promise.all([
  getJson("/api/launches"),
  getJson("/api/launches/board"),
]);
const launches = all.launches || [];
const mcaps = { ...(board.mcaps || {}) };
const volumes = { ...(board.volumes || {}) };
const mints = [...new Set(launches.map((l) => l.mint).filter(Boolean))];
try {
  const en = await postJson("/api/launches/enrich", { mints });
  Object.assign(mcaps, en.mcaps || {});
  Object.assign(volumes, en.volumes || {});
} catch (e) {
  console.warn("enrich failed", e.message);
}

const ethics = [];
const seen = new Set();
for (const l of launches) {
  if (!l?.mint || seen.has(l.mint)) continue;
  seen.add(l.mint);
  const mcap = Number.isFinite(mcaps[l.mint]) ? mcaps[l.mint] : null;
  const vol = Number.isFinite(volumes[l.mint]) ? volumes[l.mint] : null;
  ethics.push({
    id: `ethics-${l.mint}`,
    launchpadId: "ethics",
    symbol: String(l.symbol || "").trim() || l.mint.slice(0, 6),
    name: String(l.name || "").trim() || l.symbol || l.mint.slice(0, 8),
    mint: l.mint,
    status: l.launchPath === "dbc" ? "bonding" : "graduated",
    priceUsd: null,
    change24hPct: null,
    mcapUsd: mcap,
    fdvUsd: mcap,
    volume24hUsd: vol,
    liquidityUsd: null,
    holders: null,
    holdersDelta24h: null,
    ageHours: ageHours(l.createdAt),
    rangeLowUsd: null,
    rangeHighUsd: null,
    rangePos: null,
    spark24h: null,
    draft: false,
  });
}

const existing = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
const others = (existing.tokens || []).filter((t) => t.launchpadId !== "ethics");
const next = {
  updatedAt: new Date().toISOString().slice(0, 10),
  disclaimer:
    "Ethics snapshot from ethics.ltd APIs (launches + board/enrich). Bags from Bags API. No drafts. Not endorsements.",
  tokens: [...others.filter((t) => !t.draft), ...ethics],
};
fs.writeFileSync(TOKENS_PATH, JSON.stringify(next, null, 2) + "\n");
console.log(`Ethics ${ethics.length} rows; non-ethics kept ${others.filter((t) => !t.draft).length}`);
