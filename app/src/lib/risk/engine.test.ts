import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluate, parseProposal } from "./engine";
import type { Policy, Proposal, RiskContext } from "./types";

const policy: Policy = {
  mode: "autonomous",
  allowedAssets: ["SOL", "BTC"],
  maxTradeUsd: 100,
  maxDailyUsd: 250,
  maxSlippageBps: 50,
  minConviction: 60,
  maxPositionPct: 40,
  downgradeAtRisk: "high",
  rejectAtRisk: null,
  expiresAt: null,
  killSwitch: false,
};
const proposal: Proposal = { asset: "SOL", side: "buy", sizeUsd: 50, maxSlippageBps: 30, conviction: 70, riskFlag: "none" };
const ctx: RiskContext = { now: 1_000, spentTodayUsd: 0, portfolioValueUsd: 1000, positionUsd: 0, globalKill: false };

const verdict = (p: Partial<Policy> = {}, pr: Partial<Proposal> = {}, c: Partial<RiskContext> = {}) =>
  evaluate({ ...policy, ...p }, { ...proposal, ...pr }, { ...ctx, ...c }).verdict;

describe("evaluate", () => {
  it("allows a clean autonomous proposal", () => assert.equal(verdict(), "allow"));
  it("observe mode never executes", () => assert.equal(verdict({ mode: "observe" }), "log_only"));
  it("propose mode needs approval", () => assert.equal(verdict({ mode: "propose" }), "needs_approval"));

  it("kill switches reject", () => {
    assert.equal(verdict({ killSwitch: true }), "reject");
    assert.equal(verdict({}, {}, { globalKill: true }), "reject");
  });
  it("expired policy rejects, boundary included", () => {
    assert.equal(verdict({ expiresAt: 1_000 }), "reject");
    assert.equal(verdict({ expiresAt: 1_001 }), "allow");
  });
  it("rejects assets outside the universe, case-insensitive", () => {
    assert.equal(verdict({}, { asset: "DOGE" }), "reject");
    assert.equal(verdict({}, { asset: "sol" }), "allow");
  });
  it("enforces per-trade cap at the boundary", () => {
    assert.equal(verdict({}, { sizeUsd: 100 }), "allow");
    assert.equal(verdict({}, { sizeUsd: 100.01 }), "reject");
  });
  it("enforces daily cap including already spent", () => {
    assert.equal(verdict({}, { sizeUsd: 50 }, { spentTodayUsd: 200 }), "allow");
    assert.equal(verdict({}, { sizeUsd: 50 }, { spentTodayUsd: 200.01 }), "reject");
  });
  it("enforces slippage cap", () => {
    assert.equal(verdict({}, { maxSlippageBps: 50 }), "allow");
    assert.equal(verdict({}, { maxSlippageBps: 51 }), "reject");
  });
  it("enforces minimum conviction", () => {
    assert.equal(verdict({}, { conviction: 60 }), "allow");
    assert.equal(verdict({}, { conviction: 59 }), "reject");
  });
  it("caps concentration on buys, and rejects when portfolio value is zero", () => {
    assert.equal(verdict({}, { sizeUsd: 100 }, { positionUsd: 300 }), "allow"); // 400/1000 = 40%
    assert.equal(verdict({}, { sizeUsd: 100 }, { positionUsd: 301 }), "reject");
    assert.equal(verdict({}, {}, { portfolioValueUsd: 0 }), "reject");
  });
  it("sells cannot exceed the position", () => {
    assert.equal(verdict({}, { side: "sell", sizeUsd: 50 }, { positionUsd: 50 }), "allow");
    assert.equal(verdict({}, { side: "sell", sizeUsd: 50 }, { positionUsd: 49 }), "reject");
  });
  it("high contradiction downgrades autonomous to approval", () => {
    assert.equal(verdict({}, { riskFlag: "high" }), "needs_approval");
    assert.equal(verdict({}, { riskFlag: "medium" }), "allow");
    assert.equal(verdict({ downgradeAtRisk: "medium" }, { riskFlag: "medium" }), "needs_approval");
  });
  it("rejectAtRisk rejects outright", () => {
    assert.equal(verdict({ rejectAtRisk: "high" }, { riskFlag: "high" }), "reject");
    assert.equal(verdict({ rejectAtRisk: "high" }, { riskFlag: "medium" }), "allow");
  });
  it("non-finite numbers never pass", () => {
    assert.equal(verdict({}, { sizeUsd: NaN }), "reject");
    assert.equal(verdict({}, { sizeUsd: Infinity }), "reject");
    assert.equal(verdict({}, { conviction: NaN }), "reject");
    assert.equal(verdict({}, { maxSlippageBps: NaN }), "reject");
    assert.equal(verdict({}, {}, { spentTodayUsd: NaN }), "reject");
  });
  it("a rejection is never softened by mode", () => {
    for (const mode of ["observe", "propose", "autonomous"] as const) {
      assert.equal(verdict({ mode }, { sizeUsd: 1e9 }), "reject");
    }
  });
});

describe("parseProposal", () => {
  const good = { asset: " sol ", side: "buy", sizeUsd: 10, maxSlippageBps: 20, conviction: 80, riskFlag: "low" };
  it("accepts a well-formed proposal and normalises the asset", () => {
    assert.deepEqual(parseProposal(good), { ...good, asset: "SOL" });
  });
  it("rejects malformed output", () => {
    for (const bad of [
      null, "buy SOL", [], {},
      { ...good, side: "hold" },
      { ...good, sizeUsd: "10" },
      { ...good, sizeUsd: 0 },
      { ...good, sizeUsd: -5 },
      { ...good, sizeUsd: NaN },
      { ...good, conviction: 101 },
      { ...good, maxSlippageBps: -1 },
      { ...good, riskFlag: "extreme" },
      { ...good, asset: "" },
    ]) {
      assert.equal(parseProposal(bad), null, JSON.stringify(bad));
    }
  });
});
