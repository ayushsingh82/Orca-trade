import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_POLICY, parsePolicy } from "./policy";
import { STRATEGY_FNS } from "./strategies";
import type { OrcaSignal } from "@/lib/signals";

const sig = (o: Partial<OrcaSignal>): OrcaSignal => ({
  id: "x", asset: "SOL", direction: "long", conviction: 80, price: 100, change24h: 3,
  rationale: ["r"], citations: [{ id: "1", title: "t", source: "s" }], contradictions: [], riskFlag: "none", ...o,
});
const policy = { ...DEFAULT_POLICY, minConviction: 60, maxTradeUsd: 25 };

describe("momentum", () => {
  it("buys the strongest eligible long at maxTradeUsd", () => {
    const out = STRATEGY_FNS.momentum({ signals: [sig({ asset: "ETH", conviction: 70 }), sig({ asset: "SOL", conviction: 90 })], policy, positionsUsd: {} });
    assert.equal(out.proposal?.asset, "SOL");
    assert.equal(out.proposal?.side, "buy");
    assert.equal(out.proposal?.sizeUsd, 25);
  });
  it("does nothing below the conviction floor", () => {
    assert.equal(STRATEGY_FNS.momentum({ signals: [sig({ conviction: 59 })], policy, positionsUsd: {} }).proposal, null);
  });
  it("ignores assets that are not tradable or not allowed", () => {
    const out = STRATEGY_FNS.momentum({ signals: [sig({ asset: "XRP", conviction: 99 })], policy, positionsUsd: {} });
    assert.equal(out.proposal, null);
  });
  it("sells a held asset that turned short, capped by position and maxTrade", () => {
    const out = STRATEGY_FNS.momentum({ signals: [sig({ direction: "short" })], policy, positionsUsd: { SOL: 10 } });
    assert.deepEqual([out.proposal?.side, out.proposal?.sizeUsd], ["sell", 10]);
  });
});

describe("narrative_rotation", () => {
  it("requires news evidence to buy", () => {
    const none = STRATEGY_FNS.narrative_rotation({ signals: [sig({ citations: [] })], policy, positionsUsd: {} });
    assert.equal(none.proposal, null);
    const some = STRATEGY_FNS.narrative_rotation({ signals: [sig({})], policy, positionsUsd: {} });
    assert.equal(some.proposal?.side, "buy");
  });
});

describe("parsePolicy", () => {
  it("accepts defaults and rejects unsafe values", () => {
    assert.equal(typeof parsePolicy({}), "object");
    for (const bad of [
      { mode: "yolo" }, { maxTradeUsd: 0 }, { maxTradeUsd: 1e9 }, { maxTradeUsd: 50, maxDailyUsd: 10 },
      { maxSlippageBps: 5000 }, { minConviction: 101 }, { allowedAssets: [] }, { allowedAssets: ["DOGE"] },
    ]) {
      assert.equal(typeof parsePolicy(bad), "string", JSON.stringify(bad));
    }
  });
});
