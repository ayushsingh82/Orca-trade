import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokenBySymbol } from "@/lib/exec/mints";
import type { MarketRow } from "@/lib/tokens/markets";
import { buildTrendSignal, HIGH_RISK_CONVICTION_CAP } from "./signals-extended";

const row = (o: Partial<MarketRow>): MarketRow => ({ id: "x", symbol: "X", name: "X", image: null, rank: 100, price: 1, marketCap: 1e9, volume24h: 1e8, change1h: 0, change24h: 2, change7d: 12, change14d: 20, change30d: 0, sparkline: [], ath: null, athChangePct: null, isStable: false, tradable: null, ...o });

describe("buildTrendSignal", () => {
  it("is long on a strong 7d and 14d uptrend, with a trend-only rationale and no citations", () => {
    const s = buildTrendSignal(row({}), tokenBySymbol("JUP")!)!;
    assert.equal(s.direction, "long");
    assert.equal(s.asset, "JUP");
    assert.deepEqual(s.citations, []);
    assert.match(s.rationale.join(" "), /Trend only/);
    assert.equal(s.riskFlag, "none");
  });
  it("is short on a strong downtrend", () => {
    assert.equal(buildTrendSignal(row({ change7d: -12, change14d: -20 }), tokenBySymbol("JUP")!)!.direction, "short");
  });
  it("fails closed without 7d or 14d data", () => {
    assert.equal(buildTrendSignal(row({ change7d: null }), tokenBySymbol("JUP")!), null);
    assert.equal(buildTrendSignal(row({ change14d: null }), tokenBySymbol("JUP")!), null);
  });
  it("caps conviction and flags risk for high-risk tokens", () => {
    const s = buildTrendSignal(row({ change7d: 40, change14d: 60 }), tokenBySymbol("BONK")!)!;
    assert.ok(s.conviction <= HIGH_RISK_CONVICTION_CAP);
    assert.equal(s.riskFlag, "medium");
    assert.match(s.rationale.join(" "), /High-risk/);
    const std = buildTrendSignal(row({ change7d: 40, change14d: 60 }), tokenBySymbol("JUP")!)!;
    assert.ok(std.conviction > s.conviction || std.conviction === HIGH_RISK_CONVICTION_CAP + 0, "a standard token can rank higher");
  });
});
