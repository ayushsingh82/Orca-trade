import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@solana/web3.js";
import { PROGRAM_ID } from "@sqds/multisig";
import { buildTopUp, buildVaultSetup, effectiveRemaining, USDC_TOKEN, verifyLimitConfig, type OnChainLimit } from "./squads";

const creator = Keypair.generate().publicKey;
const agent = Keypair.generate().publicKey;
const treasury = Keypair.generate().publicKey;

describe("buildVaultSetup", () => {
  const s = buildVaultSetup({ creator, agentWallet: agent, dailyUsdc: 25, treasury });
  it("creates a vault and adds one spending limit, both against the Squads program", () => {
    assert.equal(s.instructions.length, 2);
    for (const ix of s.instructions) assert.ok(ix.programId.equals(PROGRAM_ID));
  });
  it("needs the user to sign (creator is a signer) plus the one ephemeral vault key", () => {
    assert.equal(s.extraSigners.length, 1);
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

describe("verifyLimitConfig", () => {
  const owner = Keypair.generate().publicKey;
  const agentKey = Keypair.generate().publicKey;
  const setup = buildVaultSetup({ creator: owner, agentWallet: agentKey, dailyUsdc: 50, treasury });
  const program = PROGRAM_ID.toBase58();
  const good = (): OnChainLimit => ({
    multisig: { configAuthority: owner.toBase58(), threshold: 1, members: [owner.toBase58()], owner: program },
    limit: {
      multisig: setup.multisigPda.toBase58(),
      createKey: setup.limitCreateKey.toBase58(),
      vaultIndex: 0,
      mint: USDC_TOKEN.mint.toBase58(),
      amount: BigInt(50_000_000),
      period: 1, // Period.Day
      remainingAmount: BigInt(50_000_000),
      lastReset: BigInt(0),
      members: [agentKey.toBase58()],
      destinations: [agentKey.toBase58()],
      owner: program,
    },
  });
  const expectation = { owner: owner.toBase58(), agent: agentKey.toBase58(), multisigPda: setup.multisigPda.toBase58(), limitPda: setup.spendingLimitPda.toBase58(), maxDailyUsdc: 50 };

  it("accepts a correctly configured vault", () => {
    assert.deepEqual(verifyLimitConfig(good(), expectation), []);
  });
  it("flags a limit address that does not derive from the stated vault", () => {
    const cfg = good();
    cfg.limit.createKey = agentKey.toBase58();
    assert.ok(verifyLimitConfig(cfg, expectation).some((p) => /does not match its vault/.test(p)));
  });
  it("flags every way the cap could be unsafe", () => {
    const cases: [string, (c: OnChainLimit) => void, RegExp][] = [
      ["agent is a vault member", (c) => c.multisig.members.push(agentKey.toBase58()), /only your wallet|must not be a vault member/],
      ["threshold above 1", (c) => (c.multisig.threshold = 2), /threshold/],
      ["someone else controls the vault", (c) => (c.multisig.configAuthority = agentKey.toBase58()), /not controlled by your wallet/],
      ["limit above what the user chose", (c) => (c.limit.amount = BigInt(500_000_000)), /higher than/],
      ["limit pays an extra destination", (c) => c.limit.destinations.push(owner.toBase58()), /only pay the agent/],
      ["limit usable by another member", (c) => c.limit.members.push(owner.toBase58()), /only the agent may use/],
      ["wrong token", (c) => (c.limit.mint = agentKey.toBase58()), /expected token/],
      ["weekly period", (c) => (c.limit.period = 2), /one day/],
      ["accounts not owned by Squads", (c) => (c.limit.owner = agentKey.toBase58()), /not owned by the Squads program/],
    ];
    for (const [name, mutate, re] of cases) {
      const cfg = good();
      mutate(cfg);
      assert.ok(verifyLimitConfig(cfg, expectation).some((p) => re.test(p)), name);
    }
  });
});

describe("effectiveRemaining", () => {
  const lim = { amount: BigInt(50), remainingAmount: BigInt(10), lastReset: BigInt(1_000) } as OnChainLimit["limit"];
  it("uses the remaining amount within the same day", () => {
    assert.equal(effectiveRemaining(lim, BigInt(1_000 + 3_600)), BigInt(10));
  });
  it("treats the limit as reset once a day has passed", () => {
    assert.equal(effectiveRemaining(lim, BigInt(1_000 + 86_400)), BigInt(50));
  });
});
