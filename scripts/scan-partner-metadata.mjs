#!/usr/bin/env node
/**
 * Discover DBC PartnerMetadata accounts and join to staging claimers.
 * Fail closed without HELIUS_API_KEY or --rpc. Does not write launchpad-labels.json.
 *
 *   npm run scan:partner-metadata
 *   node scripts/scan-partner-metadata.mjs --rpc https://api.mainnet-beta.solana.com --json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PARTNER_METADATA_DISC_B58,
  decodePartnerMetadata,
  partnerMetadataIsComplete,
} from "../packages/dbc/partner-metadata.mjs";
import { DBC_PROGRAM_ID } from "../packages/dbc/constants.mjs";
import { loadDotEnv, ROOT } from "../packages/dbc/env.mjs";
import { heliusRpc } from "../packages/dbc/helius.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LABELS = path.join(ROOT, "data", "launchpad-labels.json");
const OUT_JSON = path.join(ROOT, "data", "partner-metadata-scan.json");
const SLIM_JSON = path.join(ROOT, "data", "partner-metadata.json");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function loadLabels() {
  if (!fs.existsSync(LABELS)) return {};
  const raw = JSON.parse(fs.readFileSync(LABELS, "utf8"));
  return raw.fee_claimer_labels || {};
}

async function rpcCall(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || JSON.stringify(body.error));
  return body.result;
}

async function getProgramAccounts(apiKey, rpcUrl) {
  const filters = [{ memcmp: { offset: 0, bytes: PARTNER_METADATA_DISC_B58 } }];
  const opts = { encoding: "base64", filters };
  if (apiKey) {
    return heliusRpc(apiKey, "getProgramAccounts", [DBC_PROGRAM_ID, opts]);
  }
  return rpcCall(rpcUrl, "getProgramAccounts", [DBC_PROGRAM_ID, opts]);
}

loadDotEnv();
const writeJson = process.argv.includes("--json");
const writeSlim = process.argv.includes("--slim");
const rpcUrl = arg("--rpc", "").trim();
const apiKey = (process.env.HELIUS_API_KEY || "").trim();

if (!apiKey && !rpcUrl) {
  console.error(
    "HELIUS_API_KEY missing and no --rpc — fail closed (no PartnerMetadata scan).",
  );
  process.exit(1);
}

const rows = await getProgramAccounts(apiKey, rpcUrl);
if (!Array.isArray(rows)) {
  console.error("getProgramAccounts PartnerMetadata: empty/non-array — fail closed.");
  process.exit(1);
}

const decoded = [];
for (const row of rows) {
  const raw = row?.account?.data?.[0];
  if (!raw) continue;
  const data = Buffer.from(raw, "base64");
  const pm = decodePartnerMetadata(data);
  if (!pm) continue;
  decoded.push({
    pda: row.pubkey,
    fee_claimer: pm.fee_claimer,
    name: pm.name,
    website: pm.website,
    logo: pm.logo,
    complete: partnerMetadataIsComplete(pm),
  });
}

const labels = loadLabels();
const unlabeledNamed = decoded.filter(
  (r) => r.complete && !labels[r.fee_claimer]?.label,
);

console.log(
  `partner_metadata=${decoded.length} complete=${decoded.filter((r) => r.complete).length} unlabeled_named=${unlabeledNamed.length}`,
);
for (const r of unlabeledNamed.slice(0, 20)) {
  console.log(`  ${r.fee_claimer}  ${r.name}  ${r.website}  pda=${r.pda}`);
}
if (unlabeledNamed.length === 0) {
  console.log("No unlabeled staging-unknown claimer named on-chain this pass.");
}

if (writeJson) {
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        program: DBC_PROGRAM_ID,
        count: decoded.length,
        accounts: decoded,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`);
}

if (writeSlim) {
  const by_fee_claimer = {};
  for (const [fc, lab] of Object.entries(labels)) {
    const hit = decoded.find((r) => r.fee_claimer === fc && r.complete);
    if (!hit) continue;
    by_fee_claimer[fc] = {
      pda: hit.pda,
      name: hit.name,
      website: hit.website,
      logo: hit.logo || null,
      launchpadId: lab.launchpadId || null,
    };
  }
  fs.writeFileSync(
    SLIM_JSON,
    JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        notes: [
          "Observed DBC PartnerMetadata for labeled stock-quote fee_claimers only.",
          "Unlabeled claimers are omitted even if a PDA exists elsewhere — join via scan JSON.",
        ],
        by_fee_claimer,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Wrote ${path.relative(ROOT, SLIM_JSON)}`);
}
