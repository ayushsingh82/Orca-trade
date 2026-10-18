import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { getUser } from "@/lib/auth/session";
import { RPC_URL } from "@/lib/exec/config";
import { readLimitConfig, verifyLimitConfig } from "@/lib/exec/squads";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Links the vault only after reading it back from chain and proving the cap is real. The client is never trusted. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/agents/[id]/vault/confirm">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { multisig?: string; limit?: string; owner?: string; dailyUsdc?: number };
  const dailyUsdc = Number(body.dailyUsdc);
  if (!body.multisig || !body.limit || !body.owner || !(dailyUsdc > 0)) return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });

  const [agent] = await db().select().from(agents).where(and(eq(agents.id, id), eq(agents.userId, user.id))).limit(1);
  if (!agent) return NextResponse.json({ ok: false, error: "agent not found" }, { status: 404 });
  if (agent.paper) return NextResponse.json({ ok: false, error: "Paper agents do not use a vault" }, { status: 400 });

  try {
    const cfg = await readLimitConfig(new Connection(RPC_URL, "confirmed"), new PublicKey(body.multisig), new PublicKey(body.limit));
    const problems = verifyLimitConfig(cfg, {
      owner: body.owner,
      agent: agent.walletPublicKey,
      multisigPda: body.multisig,
      limitPda: body.limit,
      maxDailyUsdc: dailyUsdc,
    });
    if (problems.length) return NextResponse.json({ ok: false, error: `Vault is not configured safely: ${problems.join("; ")}` }, { status: 422 });
    await db()
      .update(agents)
      .set({ squadsOwner: body.owner, squadsMultisig: body.multisig, squadsLimit: body.limit, squadsDailyUsdc: dailyUsdc })
      .where(eq(agents.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "could not verify vault" }, { status: 500 });
  }
}

/** Unlinks the vault from Orca. It does not touch the chain: to revoke access, remove the limit from your vault. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/agents/[id]/vault/confirm">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  await db()
    .update(agents)
    .set({ squadsOwner: null, squadsMultisig: null, squadsLimit: null, squadsDailyUsdc: null })
    .where(and(eq(agents.id, id), eq(agents.userId, user.id)));
  return NextResponse.json({ ok: true });
}
