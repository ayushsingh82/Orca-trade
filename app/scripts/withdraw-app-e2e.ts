/**
 * App-level check of the withdraw API and the Portfolio page against a real Postgres and a local Solana chain.
 * Needs: a local validator (solana-test-validator), a local Postgres with the migrations applied, and the app
 * running on :3666 with SOLANA_RPC_URL=http://127.0.0.1:8899 plus AUTH_SECRET and AGENT_KEY_SECRET set.
 * Run: DATABASE_URL=postgresql://...@127.0.0.1:5432/orca npx tsx scripts/withdraw-app-e2e.ts
 */
import nacl from "tweetnacl"; import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Pool } from "pg";
const B = "http://localhost:3666"; const conn = new Connection("http://127.0.0.1:8899", "confirmed");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const J = { "content-type": "application/json" };
let fails = 0; const ok = (n: string, c: boolean, x = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  (" + x + ")" : ""}`); if (!c) fails++; };
async function walletLogin() {
  const kp = Keypair.generate(); const wallet = kp.publicKey.toBase58();
  const n = await (await fetch(B + "/api/auth/nonce", { method: "POST", headers: J, body: JSON.stringify({ wallet }) })).json();
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(n.message), kp.secretKey));
  const r = await fetch(B + "/api/auth/wallet", { method: "POST", headers: J, body: JSON.stringify({ wallet, signature, challenge: n.challenge }) });
  return { wallet, cookie: (r.headers.get("set-cookie") ?? "").split(";")[0], id: (await r.json()).user.id as string };
}
const api = async (cookie: string, path: string, body?: unknown, method = "POST") => { const r = await fetch(B + path, { method, headers: { ...J, cookie }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null), res: r }; };

(async () => {
  const me = await walletLogin();
  await pool.query("update users set plan='pro' where id=$1", [me.id]);
  const created = await api(me.cookie, "/api/agents", { name: "Live1", strategy: "momentum", paper: false, policy: { mode: "observe" } });
  const agent = created.json.agent; const agentKey = new PublicKey(agent.walletPublicKey);
  await conn.confirmTransaction(await conn.requestAirdrop(agentKey, 2 * LAMPORTS_PER_SOL), "confirmed");

  const owner = new PublicKey(me.wallet);
  console.log("-- security");
  ok("signed out is refused", (await api("", `/api/agents/${agent.id}/withdraw`, { asset: "SOL" })).status === 401);
  const other = await walletLogin(); await pool.query("update users set plan='pro' where id=$1", [other.id]);
  ok("another user cannot withdraw from my agent", (await api(other.cookie, `/api/agents/${agent.id}/withdraw`, { asset: "ALL" })).status === 404);
  ok("bad asset rejected", (await api(me.cookie, `/api/agents/${agent.id}/withdraw`, { asset: "BTC" })).status === 400);
  const spoof = await api(me.cookie, `/api/agents/${agent.id}/withdraw`, { asset: "SOL", amount: 0.1, destination: other.wallet, to: other.wallet });
  ok("a destination in the request is ignored: funds go to the owner", spoof.json.ok === true && (await conn.getBalance(owner)) === 0.1 * LAMPORTS_PER_SOL && (await conn.getBalance(new PublicKey(other.wallet))) === 0);
  const paper = (await api(me.cookie, "/api/agents", { name: "Paper1", strategy: "momentum" })).json.agent;
  ok("a paper agent cannot withdraw", (await api(me.cookie, `/api/agents/${paper.id}/withdraw`, { asset: "ALL" })).status === 400);
  const emailRes = await fetch(B + "/api/auth/signup", { method: "POST", headers: J, body: JSON.stringify({ email: `nw${Date.now()}@t.dev`, password: "password123" }) });
  const emailCookie = (emailRes.headers.get("set-cookie") ?? "").split(";")[0]; const emailId = (await emailRes.json()).user.id;
  await pool.query("update users set plan='pro' where id=$1", [emailId]);
  const ea = (await api(emailCookie, "/api/agents", { name: "NoWallet", strategy: "momentum", paper: false })).json.agent;
  const nw = await api(emailCookie, `/api/agents/${ea.id}/withdraw`, { asset: "ALL" });
  ok("a user with no wallet is told to add one", nw.status === 400 && /wallet/i.test(nw.json.error), nw.json.error?.slice(0, 50));

  console.log("-- withdrawals");
  const big = await api(me.cookie, `/api/agents/${agent.id}/withdraw`, { asset: "SOL", amount: 50 });
  ok("over-withdrawal is refused with a clear message", big.status === 500 && /at most/.test(big.json.error), big.json.error?.slice(0, 60));
  const all = await api(me.cookie, `/api/agents/${agent.id}/withdraw`, { asset: "ALL" });
  const ownerBal = (await conn.getBalance(owner)) / LAMPORTS_PER_SOL;
  ok("ALL sends the rest to the owner", all.json.ok && ownerBal > 1.99 && ownerBal < 2.0, `${ownerBal} SOL`);
  ok("the agent wallet is drained", (await conn.getBalance(agentKey)) === 0);
  const rows = (await pool.query("select asset, amount, destination, signature from agent_transfers where agent_id=$1 order by created_at", [agent.id])).rows;
  ok("both withdrawals are recorded, to the owner only", rows.length === 2 && rows.every((r) => r.destination === me.wallet && r.signature.length > 40), rows.map((r) => `${r.asset} ${Number(r.amount).toFixed(3)}`).join(", "));
  ok("a second ALL on the empty wallet is refused", (await api(me.cookie, `/api/agents/${agent.id}/withdraw`, { asset: "ALL" })).json.ok === false);

  console.log("-- portfolio page + CSV");
  const html = await (await fetch(B + "/portfolio", { headers: { cookie: me.cookie } })).text();
  const text = html.replace(/<script[^>]*>[^<]*<\/script>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  for (const needle of ["Total value", "Win rate", "Your wallet", "Allocation", "Live1", "Paper1", "Withdrawals", "Download history (CSV)", "in the agent wallet"]) ok(`page shows "${needle}"`, text.includes(needle));
  const csv = await fetch(B + "/api/portfolio/export", { headers: { cookie: me.cookie } });
  const csvText = await csv.text();
  ok("CSV export returns rows including withdrawals", csv.headers.get("content-type")?.includes("text/csv") === true && /withdrawal,sent,,SOL/.test(csvText), csvText.split("\n").length - 1 + " rows");
  ok("CSV needs a login", (await fetch(B + "/api/portfolio/export")).status === 401);
  await pool.end();
  console.log(fails === 0 ? "\nALL APP-LEVEL WITHDRAWAL CHECKS PASSED" : `\n${fails} FAILED`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("script error:", e); process.exit(2); });
