import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ParsedTransactionWithMeta } from "@solana/web3.js";
import { checkUsdcTransfer } from "./usdc";

const TREASURY = "Treasury1111111111111111111111111111111111";
const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const bal = (owner: string, mint: string, amt: string) => ({
  accountIndex: 1, mint, owner, uiTokenAmount: { amount: "0", decimals: 6, uiAmount: Number(amt), uiAmountString: amt },
});
const tx = (pre: ReturnType<typeof bal>[], post: ReturnType<typeof bal>[], err: unknown = null) =>
  ({ meta: { err, preTokenBalances: pre, postTokenBalances: post } }) as unknown as ParsedTransactionWithMeta;
const args = { treasuryOwner: TREASURY, mint: MINT, minAmount: 29 };

describe("checkUsdcTransfer", () => {
  it("accepts a transfer of at least the price", () => {
    assert.ok(checkUsdcTransfer(tx([bal(TREASURY, MINT, "100")], [bal(TREASURY, MINT, "129")]), args));
    assert.ok(checkUsdcTransfer(tx([bal(TREASURY, MINT, "100")], [bal(TREASURY, MINT, "150")]), args)); // overpay ok
  });
  it("handles a treasury token account that did not exist before", () => {
    assert.ok(checkUsdcTransfer(tx([], [bal(TREASURY, MINT, "29")]), args));
  });
  it("rejects underpayment", () => {
    assert.equal(checkUsdcTransfer(tx([bal(TREASURY, MINT, "100")], [bal(TREASURY, MINT, "128.99")]), args), false);
  });
  it("rejects a different token or a different recipient", () => {
    assert.equal(checkUsdcTransfer(tx([], [bal(TREASURY, "OtherMint", "500")]), args), false);
    assert.equal(checkUsdcTransfer(tx([], [bal("SomeoneElse", MINT, "500")]), args), false);
  });
  it("rejects failed transactions and missing metadata", () => {
    assert.equal(checkUsdcTransfer(tx([], [bal(TREASURY, MINT, "29")], { InstructionError: [0, "x"] }), args), false);
    assert.equal(checkUsdcTransfer({ meta: null } as unknown as ParsedTransactionWithMeta, args), false);
  });
  it("does not count the treasury sending money out as receiving", () => {
    assert.equal(checkUsdcTransfer(tx([bal(TREASURY, MINT, "100")], [bal(TREASURY, MINT, "50")]), args), false);
  });
});
