import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@solana/web3.js";
import { hasTip } from "./jito";

const key = () => Keypair.generate().publicKey;
const txWith = (keys: ReturnType<typeof key>[]) => ({ message: { staticAccountKeys: keys } }) as Parameters<typeof hasTip>[0];

describe("hasTip", () => {
  it("is true when a tip account is among the static keys", () => {
    const tip = key();
    assert.ok(hasTip(txWith([key(), tip, key()]), [tip.toBase58(), key().toBase58()]));
  });
  it("is false without one, or with an empty tip list", () => {
    assert.equal(hasTip(txWith([key(), key()]), [key().toBase58()]), false);
    assert.equal(hasTip(txWith([key()]), []), false);
  });
});
