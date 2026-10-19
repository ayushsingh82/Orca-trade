import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStablecoin, normalizeQuery, SOLANA_ECOSYSTEM_IDS, toRow } from "./markets";

describe("toRow", () => {
  const raw = {
    id: "jupiter-exchange-solana", symbol: "jup", name: "Jupiter", image: "https://x/y.png", current_price: 0.29, market_cap_rank: 77, market_cap: 1_000_000, total_volume: 5_000,
    price_change_percentage_1h_in_currency: 0.1, price_change_percentage_24h_in_currency: -2, price_change_percentage_7d_in_currency: 5,
    price_change_percentage_14d_in_currency: 8, price_change_percentage_30d_in_currency: -3, sparkline_in_7d: { price: [1, 2, "x", 3] }, ath: 2, ath_change_percentage: -85,
  };
  it("maps a market row and marks registry tokens as tradable", () => {
    const r = toRow(raw)!;
    assert.deepEqual([r.symbol, r.price, r.rank, r.change7d, r.sparkline], ["JUP", 0.29, 77, 5, [1, 2, 3]]);
    assert.equal(r.tradable?.mint, "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
    assert.equal(r.isStable, false);
  });
  it("leaves unknown tokens as view-only", () => {
    assert.equal(toRow({ ...raw, id: "some-other-coin", symbol: "xyz" })!.tradable, null);
  });
  it("rejects rows without a usable price", () => {
    assert.equal(toRow({ ...raw, current_price: null }), null);
    assert.equal(toRow({ ...raw, current_price: 0 }), null);
    assert.equal(toRow({ ...raw, id: undefined }), null);
  });
  it("tolerates missing optional fields", () => {
    const r = toRow({ id: "a", symbol: "a", name: "A", current_price: 1 })!;
    assert.deepEqual([r.rank, r.change24h, r.sparkline, r.marketCap], [null, null, [], null]);
  });
});

describe("isStablecoin", () => {
  it("catches known stablecoins and tokenised funds", () => {
    for (const s of ["USDT", "usdc", "PYUSD", "BUIDL"]) assert.equal(isStablecoin(s, "x", 1, 0), true, s);
  });
  it("catches an unlisted USD-named coin pinned near $1", () => {
    assert.equal(isStablecoin("ZUSD", "Some USD", 1.001, 0.1), true);
  });
  it("does not flag volatile or non-USD tokens", () => {
    assert.equal(isStablecoin("SOL", "Solana", 104, 3), false);
    assert.equal(isStablecoin("USDX", "Some USD", 0.8, 12), false);
  });
});

describe("normalizeQuery", () => {
  it("trims, lowercases and collapses spaces", () => assert.equal(normalizeQuery("  Bonk   Inu "), "bonk inu"));
  it("rejects queries that are too short", () => {
    assert.equal(normalizeQuery("a"), null);
    assert.equal(normalizeQuery("  "), null);
  });
  it("caps very long input", () => assert.equal(normalizeQuery("x".repeat(100))!.length, 40));
});

describe("solana list", () => {
  it("has no duplicate ids", () => assert.equal(new Set(SOLANA_ECOSYSTEM_IDS).size, SOLANA_ECOSYSTEM_IDS.length));
});
