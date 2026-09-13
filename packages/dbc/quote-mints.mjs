import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SEED = path.resolve(__dirname, "../../data/quote-mints.json");

/** Never allow as quote — even if present in a data artifact (match lib/staging/constants). */
const BLOCKED_QUOTE_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // wrapped SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

/**
 * Load the committed quote-mint allowlist (SPEC §5.1).
 * Source of truth for which DBC quote mints may appear in the screener.
 */
export function loadQuoteMints(seedPath = DEFAULT_SEED) {
  const raw = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.quote_mints || [];
  const allowlist = [];
  const seen = new Set();
  for (const row of rows) {
    const mint = typeof row?.mint === "string" ? row.mint.trim() : "";
    if (!mint || seen.has(mint) || BLOCKED_QUOTE_MINTS.has(mint)) continue;
    seen.add(mint);
    allowlist.push({
      mint,
      symbol: row.symbol ?? "",
      name: row.name ?? "",
      badge_verified_at: row.badge_verified_at ?? null,
      meta: row.meta && typeof row.meta === "object" ? row.meta : {},
    });
  }
  return allowlist;
}

export function quoteMintSet(seedPath = DEFAULT_SEED) {
  return new Set(loadQuoteMints(seedPath).map((r) => r.mint));
}
