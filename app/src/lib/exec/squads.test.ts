import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@solana/web3.js";
import { PROGRAM_ID } from "@sqds/multisig";
import { buildTopUp, buildVaultSetup } from "./squads";

const creator = Keypair.generate().publicKey;
const agent = Keypair.generate().publicKey;
const treasury = Keypair.generate().publicKey;

describe("buildVaultSetup", () => {
  const s = buildVaultSetup({ creator, agentWallet: agent, dailyUsdc: 25, treasury });
  it("creates a vault and adds one spending limit, both against the Squads program", () => {
    assert.equal(s.instructions.length, 2);
    for (const ix of s.instructions) assert.ok(ix.programId.equals(PROGRAM_ID));
  });
  it("needs the user to sign (creator is a signer) plus two ephemeral keys", () => {
    assert.equal(s.extraSigners.length, 2);
    const signers = new Set(s.instructions.flatMap((ix) => ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58())));
    assert.ok(signers.has(creator.toBase58()));
    assert.ok(!signers.has(agent.toBase58()), "the agent must not be able to change its own limit");
  });
  it("derives distinct vault and limit addresses", () => {
    assert.ok(!s.vaultPda.equals(s.multisigPda));
    assert.ok(!s.spendingLimitPda.equals(s.multisigPda));
  });
  it("rejects invalid caps", () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      assert.throws(() => buildVaultSetup({ creator, agentWallet: agent, dailyUsdc: bad, treasury }), /positive number/);
    }
  });
});

describe("buildTopUp", () => {
  const s = buildVaultSetup({ creator, agentWallet: agent, dailyUsdc: 25, treasury });
  const ixs = buildTopUp({ multisigPda: s.multisigPda, spendingLimitPda: s.spendingLimitPda, agentWallet: agent, usdc: 10 });
  it("creates the agent's token account if needed, then uses the limit", () => {
    assert.equal(ixs.length, 2);
    assert.ok(ixs[1].programId.equals(PROGRAM_ID));
  });
  it("is signed by the agent only", () => {
    const signers = ixs[1].keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58());
    assert.deepEqual(signers, [agent.toBase58()]);
  });
});
