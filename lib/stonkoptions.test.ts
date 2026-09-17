import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decimalOrNull,
  mapStonkCatalogRow,
  mapStonkPhase,
  positiveDecimalOrNull,
} from "./stonkoptions-map.ts";

describe("stonkoptions catalog map", () => {
  it("maps damm_v2 to graduated and dbc to bonding", () => {
    assert.equal(mapStonkPhase("damm_v2"), "graduated");
    assert.equal(mapStonkPhase("dbc"), "bonding");
    assert.equal(mapStonkPhase(null), "bonding");
  });

  it("parses indexer decimal strings and drops zeros", () => {
    assert.equal(decimalOrNull("289.15"), 289.15);
    assert.equal(positiveDecimalOrNull("0"), null);
    assert.equal(positiveDecimalOrNull(null), null);
  });

  it("maps a catalog row without inventing liquidity or %", () => {
    const row = mapStonkCatalogRow({
      marketId: "5b7dc63c-f670-459e-adbf-45eb3e1192f4",
      baseMint: "GHk23ckLC9nRJ3eUc8gh1Sw76g7Q9a19RZrCXBo5tBjC",
      name: "LAUNCH",
      symbol: "OFFCHAIN",
      imageUrl: "https://example.com/x.png",
      phase: "dbc",
      listedAt: "2026-09-17T00:30:36.532Z",
      priceUsd: "0.000006793246273578",
      marketCapUsd: "289.15",
      fdvUsd: "6969.21",
      volume24hUsd: "936.30",
      holdersCount: 2,
    });
    assert.ok(row);
    assert.equal(row.launchpadId, "stardotfun");
    assert.equal(row.mint, "GHk23ckLC9nRJ3eUc8gh1Sw76g7Q9a19RZrCXBo5tBjC");
    assert.equal(row.status, "bonding");
    assert.equal(row.mcapUsd, 289.15);
    assert.equal(row.fdvUsd, 6969.21);
    assert.equal(row.volume24hUsd, 936.3);
    assert.equal(row.holders, 2);
    assert.equal(row.liquidityUsd, null);
    assert.equal(row.change24hPct, null);
    assert.equal(row.spark24h, null);
  });

  it("drops rows with no mint", () => {
    assert.equal(mapStonkCatalogRow({ symbol: "X" }), null);
  });
});
