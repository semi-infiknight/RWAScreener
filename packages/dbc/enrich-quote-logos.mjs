#!/usr/bin/env node
/**
 * Enrich data/quote-mints.json with DAS logo URLs (fail soft per mint).
 * Does not re-discover badges or rewrite categories — logos only.
 *
 * Usage: node packages/dbc/enrich-quote-logos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv, ROOT } from "./env.mjs";
import { enrichMintsDas, pickLogo } from "./discover-badges.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(__dirname, "../../data/quote-mints.json");

export async function enrichQuoteLogos(opts = {}) {
  loadDotEnv(opts.root || ROOT);
  const apiKey = (opts.apiKey || process.env.HELIUS_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, reason: "HELIUS_API_KEY missing", filled: 0, total: 0 };
  }

  const outPath = opts.outPath || DEFAULT_OUT;
  const raw = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const rows = Array.isArray(raw.quote_mints) ? raw.quote_mints : [];
  if (rows.length === 0) {
    return { ok: false, reason: "no quote_mints in seed", filled: 0, total: 0 };
  }

  const mints = rows.map((r) => r.mint).filter(Boolean);
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
      filled: 0,
      total: rows.length,
    };
  }

  let filled = 0;
  let kept = 0;
  let clearedMissing = 0;
  for (const row of rows) {
    const asset = assets.get(row.mint);
    let logo = null;
    try {
      logo = asset ? pickLogo(asset) : null;
    } catch {
      logo = null;
    }
    if (!logo && typeof row.logo === "string" && row.logo.trim()) {
      logo = row.logo.trim();
      kept += 1;
    } else if (
      !logo &&
      row.meta &&
      typeof row.meta.image === "string" &&
      row.meta.image.trim()
    ) {
      logo = row.meta.image.trim();
      kept += 1;
    }

    row.logo = logo || null;
    if (!row.meta || typeof row.meta !== "object" || Array.isArray(row.meta)) {
      row.meta = {};
    }
    if (logo) {
      row.meta.image = logo;
      filled += 1;
    } else {
      delete row.meta.image;
      clearedMissing += 1;
    }
  }

  const payload = {
    ...raw,
    quote_mints: rows,
  };
  if (opts.write !== false) {
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }

  return {
    ok: true,
    reason: `logos enriched — ${filled}/${rows.length} with URL`,
    outPath,
    total: rows.length,
    filled,
    keptPrior: kept,
    missing: clearedMissing,
    dasHits: assets.size,
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = await enrichQuoteLogos();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
