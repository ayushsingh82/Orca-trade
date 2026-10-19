import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { USDC } from "./mints";
import { planWithdrawal, TX_FEE_LAMPORTS } from "./withdraw";

const usdc = (n: number) => ({ mint: USDC.mint, decimals: 6, raw: BigInt(Math.round(n * 1e6)) });
const other = { mint: "OtherMint1111111111111111111111111111111111", decimals: 8, raw: BigInt(5_000_000) };
const sol = (n: number) => BigInt(Math.round(n * 1e9));

describe("planWithdrawal", () => {
  it("ALL sweeps every held token and the remaining SOL", () => {
    const p = planWithdrawal({ lamports: sol(0.1), tokens: [usdc(40), other, { ...usdc(0), mint: "Empty" }], request: { asset: "ALL" } });
    assert.equal(p.tokens.length, 2); // the empty account is skipped
    assert.equal(p.sol, "rest");
  });
  it("ALL on an empty wallet is refused", () => {
    assert.throws(() => planWithdrawal({ lamports: BigInt(TX_FEE_LAMPORTS), tokens: [], request: { asset: "ALL" } }), /empty/);
  });
  it("USDC without an amount takes the whole USDC balance and leaves SOL alone", () => {
    const p = planWithdrawal({ lamports: sol(0.1), tokens: [usdc(40), other], request: { asset: "USDC" } });
    assert.deepEqual(p.tokens.map((t) => t.raw), [BigInt(40_000_000)]);
    assert.equal(p.sol, null);
  });
  it("USDC partial amount converts to base units", () => {
    const p = planWithdrawal({ lamports: sol(0.1), tokens: [usdc(40)], request: { asset: "USDC", amount: 12.5 } });
    assert.equal(p.tokens[0].raw, BigInt(12_500_000));
  });
  it("refuses to withdraw more USDC than the agent holds", () => {
    assert.throws(() => planWithdrawal({ lamports: sol(0.1), tokens: [usdc(10)], request: { asset: "USDC", amount: 10.01 } }), /only holds 10 USDC/);
  });
  it("refuses USDC when the agent holds none", () => {
    assert.throws(() => planWithdrawal({ lamports: sol(0.1), tokens: [other], request: { asset: "USDC" } }), /no USDC/);
  });
  it("SOL without an amount sends the rest", () => {
    assert.equal(planWithdrawal({ lamports: sol(0.1), tokens: [], request: { asset: "SOL" } }).sol, "rest");
  });
  it("SOL must leave room for the network fee", () => {
    assert.throws(() => planWithdrawal({ lamports: sol(0.1), tokens: [], request: { asset: "SOL", amount: 0.1 } }), /at most/);
    assert.equal(planWithdrawal({ lamports: sol(0.1), tokens: [], request: { asset: "SOL", amount: 0.09 } }).sol, sol(0.09));
  });
  it("rejects zero, negative and non-finite amounts", () => {
    for (const amount of [0, -1, NaN, Infinity]) {
      assert.throws(() => planWithdrawal({ lamports: sol(1), tokens: [usdc(5)], request: { asset: "USDC", amount } }), /positive number/);
    }
  });
});
