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
