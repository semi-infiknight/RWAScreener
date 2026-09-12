#!/usr/bin/env node
/**
 * Aggregate fee_claimers from data/dbc-backfill-result.json (gitignored).
 * Prints top claimers by stock-quote pool count; optional --json writes
 * data/fee-claimer-attribution.json (+ .md).
 *
 *   node scripts/summarize-fee-claimers.mjs
 *   node scripts/summarize-fee-claimers.mjs --json
 *   npm run summarize:fee-claimers
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BACKFILL = path.join(ROOT, "data", "dbc-backfill-result.json");
const LABELS = path.join(ROOT, "data", "launchpad-labels.json");
const QUOTES = path.join(ROOT, "data", "quote-mints.json");
const OUT_JSON = path.join(ROOT, "data", "fee-claimer-attribution.json");
const OUT_MD = path.join(ROOT, "data", "fee-claimer-attribution.md");

function loadJson(p) {
  if (!fs.existsSync(p)) {
    console.error(`Missing ${path.relative(ROOT, p)} — run npm run backfill:dbc first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function labelMap() {
  const raw = loadJson(LABELS);
  const m = raw.fee_claimer_labels || {};
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    out[k] = typeof v === "string" ? { label: v } : v;
  }
  return out;
}

function aggregate(bf, labels, symbolByMint) {
  const poolsByCfg = new Map();
  for (const p of bf.pools || []) {
    const list = poolsByCfg.get(p.config) || [];
    list.push(p);
    poolsByCfg.set(p.config, list);
  }

  const claimers = new Map();
  for (const c of bf.configs || []) {
    const fc = c.fee_claimer || null;
    if (!claimers.has(fc)) {
      claimers.set(fc, {
        fee_claimer: fc,
        pool_count: 0,
        config_count: 0,
        quotes: new Set(),
        first_seen_at: null,
        last_seen_at: null,
      });
    }
    const rec = claimers.get(fc);
    rec.config_count += 1;
    if (c.quote_mint) rec.quotes.add(c.quote_mint);
    const bump = (ts) => {
      if (!ts) return;
      if (!rec.first_seen_at || ts < rec.first_seen_at) rec.first_seen_at = ts;
      if (!rec.last_seen_at || ts > rec.last_seen_at) rec.last_seen_at = ts;
    };
    bump(c.first_seen_at);
    for (const p of poolsByCfg.get(c.address) || []) {
      rec.pool_count += 1;
      if (p.quote_mint) rec.quotes.add(p.quote_mint);
      bump(p.created_at);
      bump(p.activation_at);
    }
  }

  const rows = [...claimers.values()].map((rec) => {
    const quotes = [...rec.quotes].sort();
    const lab = labels[rec.fee_claimer];
    return {
      fee_claimer: rec.fee_claimer,
      pool_count: rec.pool_count,
      config_count: rec.config_count,
      quote_mint_count: quotes.length,
      sample_quote_mints: quotes.slice(0, 8),
      sample_quote_symbols: quotes
        .slice(0, 8)
        .map((m) => symbolByMint.get(m) || m.slice(0, 8)),
      first_seen_at: rec.first_seen_at,
      last_seen_at: rec.last_seen_at,
      label: lab?.label || null,
      launchpadId: lab?.launchpadId || null,
    };
  });

  rows.sort(
    (a, b) =>
      b.pool_count - a.pool_count ||
      b.config_count - a.config_count ||
      String(a.fee_claimer).localeCompare(String(b.fee_claimer)),
  );
  return rows;
}

const writeJson = process.argv.includes("--json");
const bf = loadJson(BACKFILL);
const labels = labelMap();
const qm = loadJson(QUOTES);
const symbolByMint = new Map(
  (qm.quote_mints || []).map((x) => [x.mint, x.symbol]),
);
const rows = aggregate(bf, labels, symbolByMint);
const labeled = rows.filter((r) => r.label).length;

console.log(
  `fee_claimers=${rows.length} pools=${bf.pools?.length ?? 0} configs=${bf.configs?.length ?? 0} labeled=${labeled} unknown=${rows.length - labeled}`,
);
console.log("top by pool_count:");
for (const [i, r] of rows.slice(0, 15).entries()) {
  const tag = r.label ? ` [${r.label}]` : "";
  console.log(
    `${String(i + 1).padStart(2)}. pools=${String(r.pool_count).padStart(3)} configs=${String(r.config_count).padStart(3)} ${r.fee_claimer}${tag}`,
  );
  console.log(
    `    ${r.first_seen_at} → ${r.last_seen_at} · quotes: ${r.sample_quote_symbols.join(", ")}`,
  );
}

if (writeJson) {
  const proven = {};
  for (const [fc, v] of Object.entries(labels)) {
    if (v?.label) proven[fc] = v;
  }
  const report = {
    _comment:
      "Fee_claimer aggregation from data/dbc-backfill-result.json. Gitignored.",
    generated_at: new Date().toISOString(),
    source_artifact: "data/dbc-backfill-result.json",
    source_generated_at: bf.generated_at || null,
    stats: {
      pools: bf.pools?.length ?? 0,
      configs: bf.configs?.length ?? 0,
      unique_fee_claimers: rows.length,
      labeled,
      unknown: rows.length - labeled,
    },
    proven_labels: proven,
    fee_claimers: rows,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n");

  const md = [];
  md.push("# Fee claimer attribution (DBC stock-quote backfill)\n");
  md.push(`Generated: \`${report.generated_at}\`\n`);
  md.push(
    `- Pools: **${report.stats.pools}** · Configs: **${report.stats.configs}** · Unique fee_claimers: **${report.stats.unique_fee_claimers}**`,
  );
  md.push(
    `- Labeled: **${labeled}** · Unknown: **${rows.length - labeled}**\n`,
  );
  md.push("## Top fee_claimers by pool count\n");
  md.push(
    "| pools | configs | fee_claimer | label | first_seen | last_seen | sample quotes |",
  );
  md.push("| ---: | ---: | --- | --- | --- | --- | --- |");
  for (const r of rows.slice(0, 25)) {
    md.push(
      `| ${r.pool_count} | ${r.config_count} | \`${r.fee_claimer}\` | ${r.label || "—"} | ${r.first_seen_at} | ${r.last_seen_at} | ${r.sample_quote_symbols.slice(0, 4).join(", ")} |`,
    );
  }
  fs.writeFileSync(OUT_MD, md.join("\n") + "\n");
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_MD)}`);
}
