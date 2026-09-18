import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapTrendsItem,
  mapTrendsMigrate,
  positiveDecimalOrNull,
} from "./trends-map.ts";

describe("trends ranking map", () => {
  it("maps migrate_status 2 to graduated", () => {
    assert.equal(mapTrendsMigrate(2), "graduated");
    assert.equal(mapTrendsMigrate(null), "bonding");
    assert.equal(mapTrendsMigrate(0), "bonding");
  });

  it("parses decimal strings and drops zeros", () => {
    assert.equal(positiveDecimalOrNull("243902.39"), 243902.39);
    assert.equal(positiveDecimalOrNull("0"), null);
  });

  it("maps ranking item without inventing liquidity", () => {
    const row = mapTrendsItem({
      mint_addr: "CY1P83KnKwFYostvjQcoR2HJLyEJWRBRaVQmYyyD3cR8",
      name: "@easytopredict",
      symbol: "T",
      image: "https://ipfs.io/ipfs/QmYXhFk8JLiLxemX7cTuXyMdfkykYq1tDP5r3uAtLN7FEw",
      created_at: 1760861554,
      stats: {
        market_cap: "243902.39",
        volume_24h_usd: "5869",
        price: "0.0002439024",
        holders: 5940,
        migrate_status: 2,
      },
    });
    assert.ok(row);
    assert.equal(row.launchpadId, "trends");
    assert.equal(row.status, "graduated");
    assert.equal(row.mcapUsd, 243902.39);
    assert.equal(row.volume24hUsd, 5869);
    assert.equal(row.holders, 5940);
    assert.equal(row.liquidityUsd, null);
  });
});
