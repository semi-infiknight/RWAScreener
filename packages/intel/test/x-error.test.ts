import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { XSearchError } from "../src/x-client.js";

describe("XSearchError offline hints", () => {
  it("flags 402 credits and suggests demo scan", () => {
    const err = new XSearchError(402, "credits depleted");
    assert.equal(err.isCreditsOrAuth, true);
    assert.match(err.offlineHint ?? "", /scan -- --demo/);
    assert.match(err.message, /402/);
  });

  it("flags 401/403 auth without treating 429 as credits", () => {
    assert.equal(new XSearchError(401, "unauthorized").isCreditsOrAuth, true);
    assert.equal(new XSearchError(403, "forbidden").isCreditsOrAuth, true);
    assert.equal(new XSearchError(429, "rate limited").isCreditsOrAuth, false);
    assert.equal(new XSearchError(429, "rate limited").offlineHint, undefined);
  });
});
