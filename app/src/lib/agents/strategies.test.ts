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

describe("rsi_reversion", () => {
  const rsiOf = (h1: number | null, h4: number | null, d1: number | null, w: number | null) => ({ "1h": h1, "4h": h4, "24h": d1, "7d": w });
  const run = (rsi: Record<string, ReturnType<typeof rsiOf>>, positionsUsd = {}, p = policy) =>
    STRATEGY_FNS.rsi_reversion({ signals: [sig({ asset: "SOL" }), sig({ asset: "ETH" })], policy: p, positionsUsd, rsi });

  it("does nothing without RSI data", () => {
    assert.equal(run({}).proposal, null);
    assert.match(run({}).rationale[0], /unavailable/);
  });
  it("buys an oversold dip when the weekly trend is healthy, and shows the live RSI it used", () => {
    const out = run({ SOL: rsiOf(24, 22, 35, 52), ETH: rsiOf(55, 50, 50, 50) });
    assert.deepEqual([out.proposal?.asset, out.proposal?.side], ["SOL", "buy"]);
    assert.match(out.rationale.join(" "), /RSI 1h 24 · 4h 22/);
    assert.ok((out.proposal?.conviction ?? 0) >= 60 && (out.proposal?.conviction ?? 0) <= 80);
  });
  it("does not buy a dip when the weekly trend is broken", () => {
    assert.equal(run({ SOL: rsiOf(24, 22, 35, 30), ETH: rsiOf(50, 50, 50, 50) }).proposal, null);
  });
  it("needs both short timeframes oversold", () => {
    assert.equal(run({ SOL: rsiOf(50, 22, 35, 55), ETH: rsiOf(50, 50, 50, 50) }).proposal, null);
  });
  it("respects the conviction floor", () => {
    // 4h RSI of 29 gives conviction 52, below the default floor of 60.
    assert.equal(run({ SOL: rsiOf(30, 29, 50, 55), ETH: rsiOf(50, 50, 50, 50) }).proposal, null);
  });
  it("sells a held position that is overbought on 4h, capped by position size", () => {
    const out = run({ SOL: rsiOf(75, 72, 65, 60), ETH: rsiOf(50, 50, 50, 50) }, { SOL: 12 });
    assert.deepEqual([out.proposal?.side, out.proposal?.sizeUsd], ["sell", 12]);
  });
  it("does not sell what it does not hold", () => {
    assert.equal(run({ SOL: rsiOf(75, 72, 65, 60), ETH: rsiOf(50, 50, 50, 50) }).proposal, null);
  });
});

describe("no-action runs still report live data", () => {
  it("momentum lists what it is watching, strongest first", () => {
    const out = STRATEGY_FNS.momentum({ signals: [sig({ asset: "ETH", direction: "short", conviction: 41, price: 2424 }), sig({ asset: "SOL", direction: "short", conviction: 55, price: 104.5 })], policy, positionsUsd: {} });
    assert.equal(out.proposal, null);
    assert.match(out.rationale[1], /^Watching: SOL \$104\.5 short 55 · ETH \$2,424 short 41$/);
  });
  it("narrative rotation does the same", () => {
    const out = STRATEGY_FNS.narrative_rotation({ signals: [sig({ citations: [], conviction: 70 })], policy, positionsUsd: {} });
    assert.equal(out.proposal, null);
    assert.match(out.rationale[1], /^Watching: SOL/);
  });
});
