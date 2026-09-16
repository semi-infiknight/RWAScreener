import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  FORBIDDEN_INVENTED_IDS,
  buildLabelPatch,
  overlapByClaimer,
  padRowMatchesPool,
} from "./lib/claimer-overlap.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LABELS_PATH = path.join(ROOT, "data", "launchpad-labels.json");
const CURAZI = "CuRAzi9uTgkfiXPR8ewbrsMXMVsctmggACi679QoJehx";

describe("claimer overlap matcher", () => {
  it("attributes the claimer when pad mint+config matches a staging pool", () => {
    const claimer = "Claimer1111111111111111111111111111111111111";
    const config = "Config11111111111111111111111111111111111111";
    const mint = "Mint1111111111111111111111111111111111111111";
    const pools = [
      {
        address: "Pool111111111111111111111111111111111111111",
        config,
        base_mint: mint,
        quote_mint: "Quote11111111111111111111111111111111111111",
        fee_claimer: claimer,
      },
    ];
    const padRows = [{ mint, config, pool: null }];
    assert.equal(padRowMatchesPool(padRows[0], pools[0]), "config+mint");
    const overlap = overlapByClaimer(padRows, pools);
    assert.equal(overlap.get(claimer)?.matchCount, 1);
    const patch = buildLabelPatch(
      {},
      overlap,
      {
        label: "Example Pad",
        launchpadId: "example",
        website: "https://example.invalid/",
        x: "https://x.com/example",
        evidence: "pad-api mint+config matches {n} staging pool(s)",
      },
    );
    assert.equal(patch[claimer].label, "Example Pad");
    assert.equal(patch[claimer].website, "https://example.invalid/");
    assert.match(patch[claimer].evidence, /1 staging/);
  });

  it("does not write a label when pad rows have zero overlap", () => {
    const pools = [
      {
        address: "PoolA",
        config: "CfgA",
        base_mint: "BaseA",
        quote_mint: "QuoteA",
        fee_claimer: "ClaimerA",
      },
    ];
    const padRows = [{ mint: "OtherMint", config: "OtherCfg", pool: "OtherPool" }];
    const overlap = overlapByClaimer(padRows, pools);
    assert.equal(overlap.size, 0);
    const patch = buildLabelPatch(
      {},
      overlap,
      {
        label: "Bags",
        launchpadId: "bags",
        website: "https://bags.fm",
        evidence: "should not apply",
      },
    );
    assert.deepEqual(patch, {});
  });

  it("mint-only (no pool, no matching config) is not a hit", () => {
    const mint = "SharedMint";
    const how = padRowMatchesPool(
      { mint, config: null, pool: null },
      {
        address: "PoolZ",
        config: "CfgZ",
        base_mint: mint,
        quote_mint: "QuoteZ",
        fee_claimer: "ClaimerZ",
      },
    );
    assert.equal(how, null);
  });
});

describe("launchpad-labels.json invariants", () => {
  const raw = JSON.parse(fs.readFileSync(LABELS_PATH, "utf8"));
  const map = raw.fee_claimer_labels || {};

  it("every labeled row has label, website, evidence, and x", () => {
    const keys = Object.keys(map);
    assert.ok(keys.length >= 1, "expected at least one proven label");
    for (const [fc, row] of Object.entries(map)) {
      assert.ok(fc.length >= 32, `short claimer key ${fc}`);
      assert.equal(typeof row.label, "string");
      assert.ok(row.label.trim(), `${fc} missing label`);
      assert.equal(typeof row.website, "string");
      assert.ok(/^https?:\/\//.test(row.website), `${fc} missing website`);
      assert.equal(typeof row.evidence, "string");
      assert.ok(row.evidence.trim(), `${fc} missing evidence`);
      assert.equal(typeof row.x, "string");
      assert.ok(/^https?:\/\/(x\.com|twitter\.com)\//.test(row.x), `${fc} missing x`);
    }
  });

  it("does not invent Bags/Perpspad/ClawPump/LFOwn/StonkOptions claimers", () => {
    for (const [fc, row] of Object.entries(map)) {
      const id = String(row.launchpadId || "").toLowerCase();
      const evidence = String(row.evidence || "");
      const pmProven = /PartnerMetadata/i.test(evidence);
      assert.equal(
        FORBIDDEN_INVENTED_IDS.includes(id) && !pmProven,
        false,
        `invented ${id} for ${fc}`,
      );
    }
    assert.equal(map[CURAZI], undefined, "CuRAzi9u labeled without mint+config evidence");
  });
});
