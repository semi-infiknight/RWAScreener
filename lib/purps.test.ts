import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPurpsMeteoraDbc,
  mapPurpsCoin,
  mapPurpsStatus,
} from "./purps-map.ts";

describe("purps coins map", () => {
  it("keeps launchpad/meteora Solana and drops pump/pons", () => {
    assert.equal(isPurpsMeteoraDbc({ origin: "launchpad", chain: "solana" }), true);
    assert.equal(isPurpsMeteoraDbc({ origin: "meteora", chain: "solana" }), true);
    assert.equal(isPurpsMeteoraDbc({ origin: "pumpfun", chain: "solana" }), false);
    assert.equal(isPurpsMeteoraDbc({ origin: "launchpad", chain: "robinhood" }), false);
  });

  it("maps launch.migrated to graduated only", () => {
    assert.equal(mapPurpsStatus({ launch: { migrated: true } }), "graduated");
    assert.equal(mapPurpsStatus({ launch: { migrated: false, curvePct: 40 } }), "bonding");
    assert.equal(mapPurpsStatus({ launch: null }), "bonding");
  });

  it("maps mcap/holders/age without inventing volume", () => {
    const row = mapPurpsCoin({
      mintAddress: "purpFPo5voy6fEu8jxSCwVdMs1zyYEYAH6FBQvTYCZK",
      name: "Purps",
      symbol: "PURPS",
      imageUrl: "https://purps.lol/purps-mark-1000.png",
      createdAt: "2026-08-20T20:23:31.100Z",
      origin: "meteora",
      chain: "solana",
      mcap: 1403097.57,
      holders: 2496,
      launch: null,
    });
    assert.ok(row);
    assert.equal(row.launchpadId, "purps");
    assert.equal(row.status, "bonding");
    assert.equal(row.mcapUsd, 1403097.57);
    assert.equal(row.holders, 2496);
    assert.equal(row.volume24hUsd, null);
    assert.equal(row.priceUsd, null);
  });
});
