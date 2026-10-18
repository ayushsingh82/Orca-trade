import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { getUser } from "@/lib/auth/session";
import { RPC_URL } from "@/lib/exec/config";
import { buildVaultSetup, readTreasury } from "@/lib/exec/squads";

export const runtime = "nodejs";

/**
 * Builds the transaction the user signs in their own wallet: create a 1-of-1 Squads vault they control and add one
 * daily spending limit that only this agent can use. Nothing is stored yet; /confirm verifies the chain afterwards.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/agents/[id]/vault/setup">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { dailyUsdc?: number; creator?: string };
  const dailyUsdc = Number(body.dailyUsdc);
  if (!(dailyUsdc > 0) || dailyUsdc > 1_000_000) return NextResponse.json({ ok: false, error: "Enter a daily limit in USDC" }, { status: 400 });
  let creator: PublicKey;
  try {
    creator = new PublicKey(String(body.creator));
  } catch {
    return NextResponse.json({ ok: false, error: "Connect a Solana wallet first" }, { status: 400 });
  }

  const [agent] = await db().select().from(agents).where(and(eq(agents.id, id), eq(agents.userId, user.id))).limit(1);
  if (!agent) return NextResponse.json({ ok: false, error: "agent not found" }, { status: 404 });
  if (agent.paper) return NextResponse.json({ ok: false, error: "Paper agents do not use a vault" }, { status: 400 });
  if (agent.squadsMultisig) return NextResponse.json({ ok: false, error: "This agent already has a vault. Unlink it first." }, { status: 409 });

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const setup = buildVaultSetup({ creator, agentWallet: new PublicKey(agent.walletPublicKey), dailyUsdc, treasury: await readTreasury(connection) });
    const latest = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: creator, ...latest }).add(...setup.instructions);
    tx.partialSign(...setup.extraSigners); // the user's wallet adds its own signature
    return NextResponse.json({
      ok: true,
      transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
      multisig: setup.multisigPda.toBase58(),
      limit: setup.spendingLimitPda.toBase58(),
      vault: setup.vaultPda.toBase58(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "could not build transaction" }, { status: 500 });
  }
}
