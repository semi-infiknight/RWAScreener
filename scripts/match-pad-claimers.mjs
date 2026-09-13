#!/usr/bin/env node
/**
 * Score pad-catalog rows against staging pools via mint+config / pool address.
 * Does not write labels — print overlap only. Writes stay in launchpad-labels.json
 * after a human-checked Ember/Ethics/OTC-bar hit.
 *
 *   node scripts/match-pad-claimers.mjs --launches path.json --pad path.json --pad-id embercurve
 */
import fs from "fs";
import { overlapByClaimer, buildLabelPatch } from "./lib/claimer-overlap.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const launchesPath = arg("--launches");
const padPath = arg("--pad");
const padId = arg("--pad-id", "unknown");
if (!launchesPath || !padPath) {
  console.error("usage: --launches <staging-launches.json> --pad <pad-rows.json> [--pad-id id]");
  process.exit(1);
}

const launchesFile = JSON.parse(fs.readFileSync(launchesPath, "utf8"));
const pools = Array.isArray(launchesFile)
  ? launchesFile
  : launchesFile.launches || [];
const padFile = JSON.parse(fs.readFileSync(padPath, "utf8"));
const padRows = Array.isArray(padFile) ? padFile : padFile.rows || [];

const overlap = overlapByClaimer(padRows, pools);
const rows = [...overlap.entries()].sort((a, b) => b[1].matchCount - a[1].matchCount);
console.log(`pad=${padId} pools=${pools.length} padRows=${padRows.length} claimers_hit=${rows.length}`);
for (const [fc, rec] of rows) {
  console.log(`${rec.matchCount}\t${JSON.stringify(rec.hows)}\t${fc}`);
}
const patch = buildLabelPatch({}, overlap, {
  label: padId,
  launchpadId: padId,
  website: "https://invalid.example",
  evidence: "dry-run {n} matches — not written",
});
console.log("dry_run_patch_keys", Object.keys(patch).length);
