import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossCheck } from "./reference";

describe("crossCheck", () => {
  it("averages sources that agree", () => {
    assert.equal(crossCheck([100, 101], 150), 100.5);
    assert.equal(crossCheck([100], 150), 100);
  });
  it("accepts the boundary and rejects just beyond it", () => {
    assert.doesNotThrow(() => crossCheck([100, 101.5], 150)); // exactly 150bps
    assert.throws(() => crossCheck([100, 101.6], 150), /disagree/);
  });
  it("is order independent", () => {
    assert.throws(() => crossCheck([102, 100], 150), /disagree/);
  });
  it("fails closed on bad inputs", () => {
    for (const bad of [[], [NaN], [100, 0], [100, -1], [Infinity, 100]]) {
      assert.throws(() => crossCheck(bad), /unavailable or invalid/, JSON.stringify(bad));
    }
  });
});

import { MIN_LIQUIDITY_USD, pickJupiterPrice } from "./reference";

describe("pickJupiterPrice", () => {
  const mint = "MintAAAA1111111111111111111111111111111111";
  const ok = { id: mint, usdPrice: 0.29, liquidity: 5_000_000, isVerified: true };
  it("returns the price and liquidity of the matching mint, ignoring look-alikes", () => {
    assert.deepEqual(pickJupiterPrice([{ id: "other", usdPrice: 9, liquidity: 9e9, isVerified: true }, ok], mint), { price: 0.29, liquidity: 5_000_000 });
  });
  it("refuses a token that is missing, unverified or priceless", () => {
    assert.throws(() => pickJupiterPrice([], mint), /not found/);
    assert.throws(() => pickJupiterPrice({ error: "rate limited" }, mint), /not found/);
    assert.throws(() => pickJupiterPrice([{ ...ok, isVerified: false }], mint), /not verified/);
    assert.throws(() => pickJupiterPrice([{ ...ok, usdPrice: 0 }], mint), /no price/);
  });
  it("enforces the liquidity floor", () => {
    assert.throws(() => pickJupiterPrice([{ ...ok, liquidity: MIN_LIQUIDITY_USD - 1 }], mint), /below/);
    assert.doesNotThrow(() => pickJupiterPrice([{ ...ok, liquidity: MIN_LIQUIDITY_USD }], mint));
  });
});
