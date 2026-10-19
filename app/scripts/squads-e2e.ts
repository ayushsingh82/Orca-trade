/**
 * End-to-end check of the Squads daily-funding cap against the real Squads v4 program.
 *
 * Needs a local validator with the program cloned from devnet:
 *   solana-test-validator --reset --url devnet \
 *     --clone-upgradeable-program SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf \
 *     --clone BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr
 * Run: npx tsx scripts/squads-e2e.ts   (RPC defaults to http://127.0.0.1:8899)
 *
 * The token is a throwaway 6-decimal mint standing in for USDC, which does not exist on a local chain.
 */
import {
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { buildTopUp, buildVaultSetup, readLimitConfig, readTreasury, squadsAddresses, verifyLimitConfig, type TokenSpec } from "../src/lib/exec/squads";
import { pullFromVault, vaultAvailableUsdc } from "../src/lib/exec/vault";

const connection = new Connection(process.env.RPC ?? "http://127.0.0.1:8899", "confirmed");
let failures = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};
async function expectFail(name: string, run: () => Promise<unknown>, match?: RegExp) {
  try {
    await run();
    ok(name, false, "expected a failure but it succeeded");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ok(name, !match || match.test(msg), msg.slice(0, 110).replace(/\s+/g, " "));
  }
}
async function fund(k: Keypair, sol = 5) {
  await connection.confirmTransaction(await connection.requestAirdrop(k.publicKey, sol * LAMPORTS_PER_SOL), "confirmed");
}
const balanceOf = async (owner: PublicKey, token: TokenSpec) => {
  try {
    return (await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(token.mint, owner, true))).value.uiAmount ?? 0;
  } catch {
    return 0;
  }
};

(async () => {
  const owner = Keypair.generate();
  const agent = Keypair.generate();
  const attacker = Keypair.generate();
  await Promise.all([fund(owner), fund(agent, 1), fund(attacker, 1)]);

  const mint = await createMint(connection, owner, owner.publicKey, null, 6);
  const token: TokenSpec = { mint, decimals: 6 };
  const ownerAta = await getOrCreateAssociatedTokenAccount(connection, owner, mint, owner.publicKey);
  await mintTo(connection, owner, mint, ownerAta.address, owner, 1_000_000_000); // 1,000 tokens

  // 1. The user creates a 1-of-1 vault with a 50/day limit for the agent.
  const treasury = await readTreasury(connection);
  const setup = buildVaultSetup({ creator: owner.publicKey, agentWallet: agent.publicKey, dailyUsdc: 50, treasury, token });
  const tx = new Transaction().add(...setup.instructions);
  await sendAndConfirmTransaction(connection, tx, [owner, ...setup.extraSigners]);
  ok("vault + limit created on chain", true, setup.multisigPda.toBase58().slice(0, 8));

  // 2. The chain state passes verification, and tampered expectations do not.
  const cfg = await readLimitConfig(connection, setup.multisigPda, setup.spendingLimitPda);
  const expect = { owner: owner.publicKey.toBase58(), agent: agent.publicKey.toBase58(), multisigPda: setup.multisigPda.toBase58(), limitPda: setup.spendingLimitPda.toBase58(), token, maxDailyUsdc: 50 };
  ok("verifyLimitConfig accepts the real setup", verifyLimitConfig(cfg, expect).length === 0, verifyLimitConfig(cfg, expect).join("; "));
  ok("rejects a wrong owner", verifyLimitConfig(cfg, { ...expect, owner: attacker.publicKey.toBase58() }).length > 0);
  ok("rejects a lower promised cap", verifyLimitConfig(cfg, { ...expect, maxDailyUsdc: 10 }).some((p) => /higher than/.test(p)));
  ok("rejects a different agent", verifyLimitConfig(cfg, { ...expect, agent: attacker.publicKey.toBase58() }).length > 0);

  // 3. The user funds the vault with 200.
  const { vault } = squadsAddresses(setup.multisigPda);
  const vaultAta = await getOrCreateAssociatedTokenAccount(connection, owner, mint, vault, true);
  await transfer(connection, owner, ownerAta.address, vaultAta.address, owner, 200_000_000);
  ok("vault funded with 200", (await balanceOf(vault, token)) === 200);

  // 4. The agent pulls what a trade needs, within the limit.
  const link = { owner: expect.owner, multisig: expect.multisigPda, limit: expect.limitPda, dailyUsdc: 50 };
  ok("available capital = min(vault 200, daily limit 50) = 50", (await vaultAvailableUsdc(connection, link, agent.publicKey, token)) === 50);
  ok("a tampered link counts as zero capital", (await vaultAvailableUsdc(connection, { ...link, dailyUsdc: 10 }, agent.publicKey, token)) === 0);
  const r1 = await pullFromVault({ connection, agent, link, neededUsdc: 30, send: true, token });
  ok("agent pulled 30 for a 30 trade", r1.pulled === 30 && (await balanceOf(agent.publicKey, token)) === 30, r1.signature?.slice(0, 8));
  const r0 = await pullFromVault({ connection, agent, link, neededUsdc: 20, send: true, token });
  ok("no pull when it already holds enough", r0.pulled === 0);
  const r2 = await pullFromVault({ connection, agent, link, neededUsdc: 50, send: true, token });
  ok("pulls only the 20 shortfall, reaching the 50 cap", r2.pulled === 20 && (await balanceOf(agent.publicKey, token)) === 50);

  // 5. The cap holds, both in Orca's planner and in the Squads program itself.
  await expectFail("planner refuses once the daily limit is spent", () => pullFromVault({ connection, agent, link, neededUsdc: 60, send: true, token }), /daily limit reached/);
  await expectFail(
    "the PROGRAM rejects an over-limit pull that bypasses Orca",
    async () => {
      const bypass = new Transaction().add(...buildTopUp({ multisigPda: setup.multisigPda, spendingLimitPda: setup.spendingLimitPda, agentWallet: agent.publicKey, usdc: 10, token }));
      await sendAndConfirmTransaction(connection, bypass, [agent]);
    },
    /custom program error|0x|exceed|limit|failed/i,
  );
  ok("vault still holds 150 after the rejected attempts", (await balanceOf(vault, token)) === 150);
  ok("available capital is 0 once the daily limit is spent", (await vaultAvailableUsdc(connection, link, agent.publicKey, token)) === 0);

  // 6. Nobody else can use the limit.
  await expectFail(
    "a different wallet cannot draw on the agent's limit",
    async () => {
      const steal = new Transaction().add(...buildTopUp({ multisigPda: setup.multisigPda, spendingLimitPda: setup.spendingLimitPda, agentWallet: attacker.publicKey, usdc: 1, token }));
      await sendAndConfirmTransaction(connection, steal, [attacker]);
    },
    /custom program error|0x|member|failed/i,
  );

  // 7. If the on-chain limit is higher than what Orca recorded the user choosing, Orca refuses to fund.
  await expectFail(
    "refuses to fund when the on-chain limit exceeds the recorded cap",
    () => pullFromVault({ connection, agent, link: { ...link, dailyUsdc: 10 }, neededUsdc: 60, send: true, token }),
    /not safe/,
  );

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("script error:", e);
  process.exit(2);
});
