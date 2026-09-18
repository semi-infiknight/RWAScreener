import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSolanaMint,
  mcapFromJupiterToken,
  parsePlatformTokenSeed,
} from "./platform-tokens-map.ts";

const known = new Set(["embercurve", "purps", "stardotfun"]);

describe("platform token seed", () => {
  it("accepts the Jupiter-verified PURPS mint", () => {
    const rows = parsePlatformTokenSeed(
      {
        tokens: [
          {
            launchpadId: "purps",
            symbol: "PURPS",
            mint: "purpFPo5voy6fEu8jxSCwVdMs1zyYEYAH6FBQvTYCZK",
          },
        ],
      },
      known,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].symbol, "PURPS");
  });

  it("accepts a verified mint for a known pad", () => {
    const rows = parsePlatformTokenSeed(
      {
        tokens: [
          {
            launchpadId: "embercurve",
            symbol: "EMBER",
            mint: "5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6",
          },
        ],
      },
      known,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].symbol, "EMBER");
  });

  it("drops unknown pads, bad mints, and duplicates", () => {
    const rows = parsePlatformTokenSeed(
      {
        tokens: [
          {
            launchpadId: "not-a-pad",
            symbol: "FAKE",
            mint: "5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6",
          },
          {
            launchpadId: "purps",
            symbol: "PURPS",
            mint: "not-a-mint",
          },
          {
            launchpadId: "embercurve",
            symbol: "EMBER",
            mint: "5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6",
          },
          {
            launchpadId: "stardotfun",
            symbol: "STAR",
            mint: "5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6",
          },
        ],
      },
      known,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].launchpadId, "embercurve");
  });

  it("rejects short or invented mint strings", () => {
    assert.equal(isSolanaMint("abc"), false);
    assert.equal(isSolanaMint(""), false);
    assert.equal(
      isSolanaMint("StargWr5r6r8gZSjmEKGZ1dmvKWkj79r2z1xqjFstar"),
      true,
    );
  });
});

describe("jupiter mcap parse", () => {
  it("reads mcap only when the mint id matches", () => {
    const mint = "5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6";
    assert.equal(
      mcapFromJupiterToken([{ id: mint, mcap: 12_345_678.9 }], mint),
      12_345_678.9,
    );
    assert.equal(
      mcapFromJupiterToken([{ id: "other", mcap: 99 }], mint),
      null,
    );
    assert.equal(mcapFromJupiterToken({ mcap: 1 }, mint), null);
  });
});
