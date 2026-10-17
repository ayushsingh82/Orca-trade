import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convictionFrom, scoreSignal } from "./scoring";

describe("scoreSignal", () => {
  it("fails closed without trend data", () => {
    assert.equal(scoreSignal({ return7dPct: null, return14dPct: 5, newsBias: 50 }), null);
    assert.equal(scoreSignal({ return7dPct: 5, return14dPct: null, newsBias: 50 }), null);
  });
  it("is neutral with flat trend and no news (24h change is not an input)", () => {
    const r = scoreSignal({ return7dPct: 0, return14dPct: 0, newsBias: 0 });
    assert.equal(r?.direction, "neutral");
  });
  it("goes long on sustained uptrend and short on sustained downtrend", () => {
    assert.equal(scoreSignal({ return7dPct: 6, return14dPct: 10, newsBias: 0 })?.direction, "long");
    assert.equal(scoreSignal({ return7dPct: -6, return14dPct: -10, newsBias: 0 })?.direction, "short");
  });
  it("only very strong news alone can clear the direction threshold", () => {
    assert.equal(scoreSignal({ return7dPct: 0, return14dPct: 0, newsBias: 100 })?.direction, "long"); // 100*0.3=30 > 15
    assert.equal(scoreSignal({ return7dPct: 0, return14dPct: 0, newsBias: 40 })?.direction, "neutral"); // 12 < 15
  });
  it("is bounded to -100..100", () => {
    const r = scoreSignal({ return7dPct: 1e6, return14dPct: 1e6, newsBias: 1e6 });
    assert.ok(r && r.score <= 100 && r.score >= -100);
  });
});

describe("convictionFrom", () => {
  it("caps at 85 and floors at 5", () => {
    assert.equal(convictionFrom({ score: 100, direction: "long", headlines: 10, worstSeverity: 0 }), 85);
    assert.equal(convictionFrom({ score: 0, direction: "neutral", headlines: 0, worstSeverity: 3 }), 5);
  });
  it("contradictions reduce conviction", () => {
    const clean = convictionFrom({ score: 50, direction: "long", headlines: 1, worstSeverity: 0 });
    const flagged = convictionFrom({ score: 50, direction: "long", headlines: 1, worstSeverity: 3 });
    assert.ok(flagged < clean);
  });
});
