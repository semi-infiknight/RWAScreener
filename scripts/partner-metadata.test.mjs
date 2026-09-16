import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  decodePartnerMetadata,
  partnerMetadataIsComplete,
  PARTNER_METADATA_DISC,
} from "../packages/dbc/partner-metadata.mjs";
import { buildPartnerMetadataPatch } from "./lib/claimer-overlap.mjs";

/** Live PURPS PartnerMetadata account (2026-09-16 public RPC). */
const PURPS_B64 =
  "RESCExDRYpzaL7ZLt/g0sKLodLpyYnXvslnMKaCcISsLmC6rWBw22QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAABQVVJQUxIAAABodHRwczovL3B1cnBzLmxvbC8lAAAAaHR0cHM6Ly9wdXJwcy5sb2wvcHVycHMtbWFyay0xMDAwLnBuZw==";
const PURPS_CLAIMER = "Fgi5M4W2VzoHWbvcv6RWJRVcJu91frZ18ttGJzMJZu1z";

describe("PartnerMetadata decode", () => {
  it("decodes fee_claimer, name, website, logo from a live PURPS account", () => {
    const pm = decodePartnerMetadata(Buffer.from(PURPS_B64, "base64"));
    assert.ok(pm);
    assert.equal(pm.fee_claimer, PURPS_CLAIMER);
    assert.equal(pm.name, "PURPS");
    assert.equal(pm.website, "https://purps.lol/");
    assert.match(pm.logo, /purps-mark/);
    assert.equal(partnerMetadataIsComplete(pm), true);
  });

  it("rejects wrong discriminator", () => {
    const buf = Buffer.from(PURPS_B64, "base64");
    buf[0] = 0;
    assert.equal(decodePartnerMetadata(buf), null);
  });

  it("exports the documented 8-byte disc", () => {
    assert.deepEqual([...PARTNER_METADATA_DISC], [68, 68, 130, 19, 16, 209, 98, 156]);
  });
});

describe("PartnerMetadata label patch", () => {
  it("proposes a label for an unlabeled complete profile", () => {
    const fc = "UnlabeledClaimer111111111111111111111111111";
    const patch = buildPartnerMetadataPatch(
      {},
      [
        {
          fee_claimer: fc,
          pda: "Pda11111111111111111111111111111111111111111",
          name: "Example Pad",
          website: "https://example.invalid/",
        },
      ],
    );
    assert.equal(patch[fc].label, "Example Pad");
    assert.equal(patch[fc].launchpadId, "examplepad");
    assert.match(patch[fc].evidence, /PartnerMetadata/);
  });

  it("does not overwrite an existing label", () => {
    const patch = buildPartnerMetadataPatch(
      { [PURPS_CLAIMER]: { label: "PURPS" } },
      [
        {
          fee_claimer: PURPS_CLAIMER,
          name: "Other",
          website: "https://other.invalid/",
        },
      ],
    );
    assert.deepEqual(patch, {});
  });

  it("ignores incomplete profiles (no website)", () => {
    const patch = buildPartnerMetadataPatch(
      {},
      [{ fee_claimer: "Abc1111111111111111111111111111111111111111", name: "Nope" }],
    );
    assert.deepEqual(patch, {});
  });
});

describe("partner-metadata.json seed", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const pm = JSON.parse(
    fs.readFileSync(path.join(root, "data", "partner-metadata.json"), "utf8"),
  );
  const labels = JSON.parse(
    fs.readFileSync(path.join(root, "data", "launchpad-labels.json"), "utf8"),
  ).fee_claimer_labels;

  it("only stores PartnerMetadata for already-labeled claimers", () => {
    for (const [fc, row] of Object.entries(pm.by_fee_claimer || {})) {
      assert.ok(labels[fc]?.label, `unlabeled claimer in partner-metadata.json: ${fc}`);
      assert.equal(typeof row.pda, "string");
      assert.ok(row.pda.length >= 32);
      assert.ok(row.name);
      assert.match(row.website, /^https?:\/\//);
    }
  });
});
