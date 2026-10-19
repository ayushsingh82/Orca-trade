/**
 * End-to-end check of withdrawing from an agent wallet to its owner, on a local chain that has the real USDC and
 * wBTC mints cloned from mainnet.
 *
 *   1. npx tsx scripts/withdraw-e2e-prep.ts     (prints the two token accounts to preload)
 *   2. solana-test-validator --reset --url mainnet-beta \
 *        --clone EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --clone 3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh \
 *        --account <USDC_ATA> /tmp/orca-withdraw-e2e/usdc-ata.json --account <BTC_ATA> /tmp/orca-withdraw-e2e/btc-ata.json
 *   3. npx tsx scripts/withdraw-e2e.ts
 */
import { readFileSync } from "node:fs";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { executeWithdrawal } from "../src/lib/exec/withdraw";

const keys = JSON.parse(readFileSync("/tmp/orca-withdraw-e2e/keys.json", "utf8"));
const agent = Keypair.fromSecretKey(Uint8Array.from(keys.agent));
const owner = Keypair.fromSecretKey(Uint8Array.from(keys.owner));
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const WBTC = new PublicKey("3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh");
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
let fails = 0;
const ok = (n: string, c: boolean, x = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  (" + x + ")" : ""}`); if (!c) fails++; };
const bal = async (owner_: PublicKey, mint: PublicKey) => {
  try { return (await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, owner_))).value.uiAmount ?? 0; } catch { return 0; }
};
async function expectFail(n: string, run: () => Promise<unknown>, re: RegExp) {
  try { await run(); ok(n, false, "should have failed"); } catch (e) { const m = (e as Error).message; ok(n, re.test(m), m.slice(0, 90)); }
}

(async () => {
  await connection.confirmTransaction(await connection.requestAirdrop(agent.publicKey, 1 * LAMPORTS_PER_SOL), "confirmed");
  ok("agent starts with 100 USDC and 0.5 wBTC", (await bal(agent.publicKey, USDC)) === 100 && (await bal(agent.publicKey, WBTC)) === 0.5);
  ok("owner starts with nothing", (await bal(owner.publicKey, USDC)) === 0 && (await connection.getBalance(owner.publicKey)) === 0);

  await expectFail("cannot withdraw to the agent wallet itself", () => executeWithdrawal({ connection, agent, owner: agent.publicKey, request: { asset: "ALL" } }), /itself/);
  await expectFail("cannot withdraw more USDC than held", () => executeWithdrawal({ connection, agent, owner: owner.publicKey, request: { asset: "USDC", amount: 100.01 } }), /only holds 100 USDC/);
  ok("rejected attempts moved nothing", (await bal(agent.publicKey, USDC)) === 100 && (await bal(owner.publicKey, USDC)) === 0);

  const part = await executeWithdrawal({ connection, agent, owner: owner.publicKey, request: { asset: "USDC", amount: 30 } });
  ok("partial USDC withdrawal: owner gets 30, agent keeps 70", (await bal(owner.publicKey, USDC)) === 30 && (await bal(agent.publicKey, USDC)) === 70, part.signatures[0].slice(0, 8));
  ok("owner's token account was created by the agent, owner paid nothing", (await connection.getBalance(owner.publicKey)) === 0);
  ok("wBTC untouched by a USDC-only withdrawal", (await bal(agent.publicKey, WBTC)) === 0.5 && (await bal(owner.publicKey, WBTC)) === 0);

  const sol = await executeWithdrawal({ connection, agent, owner: owner.publicKey, request: { asset: "SOL", amount: 0.2 } });
  ok("SOL withdrawal sends exactly 0.2", (await connection.getBalance(owner.publicKey)) === 0.2 * LAMPORTS_PER_SOL, sol.signatures[0].slice(0, 8));

  const all = await executeWithdrawal({ connection, agent, owner: owner.publicKey, request: { asset: "ALL" } });
  ok("ALL: every USDC and wBTC reaches the owner", (await bal(owner.publicKey, USDC)) === 100 && (await bal(owner.publicKey, WBTC)) === 0.5);
  ok("ALL: the agent token balances are zero", (await bal(agent.publicKey, USDC)) === 0 && (await bal(agent.publicKey, WBTC)) === 0);
  const left = await connection.getBalance(agent.publicKey);
  ok("ALL: the agent keeps no SOL (only the unsendable dust)", left < 5000 + 1, `${left} lamports left`);
  ok("ALL: reports each asset moved", ["USDC", "SOL"].every((a) => all.moved.some((m) => m.asset === a)) && all.moved.length === 3, all.moved.map((m) => m.asset.slice(0, 4)).join(","));

  await expectFail("an empty agent wallet is refused", () => executeWithdrawal({ connection, agent, owner: owner.publicKey, request: { asset: "ALL" } }), /empty|nothing|no SOL/);
  console.log(fails === 0 ? "\nALL WITHDRAWAL CHECKS PASSED" : `\n${fails} FAILED`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("script error:", e); process.exit(2); });
