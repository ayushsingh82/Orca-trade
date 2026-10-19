import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "@/db";
import { agentTransfers, agents, users } from "@/db/schema";
import { sendAlert } from "@/lib/alerts";
import { getUser } from "@/lib/auth/session";
import { RPC_URL } from "@/lib/exec/config";
import { loadAgentKeypair } from "@/lib/exec/signer";
import { executeWithdrawal, type WithdrawRequest } from "@/lib/exec/withdraw";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sends funds from a live agent's wallet to the signed-in owner's OWN wallet. The destination is read from the
 * account, never from the request, so a stolen session cannot redirect funds to another address.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/agents/[id]/withdraw">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const limit = rateLimit(`withdraw:${user.id}`, 10, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many withdrawals. Try again later." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { asset?: string; amount?: number };
  const asset = body.asset;
  if (asset !== "ALL" && asset !== "USDC" && asset !== "SOL") return NextResponse.json({ ok: false, error: "asset must be ALL, USDC or SOL" }, { status: 400 });
  const request: WithdrawRequest = { asset, amount: body.amount === undefined || body.amount === null ? undefined : Number(body.amount) };
  if (asset === "ALL") request.amount = undefined;

  const [agent] = await db().select().from(agents).where(and(eq(agents.id, id), eq(agents.userId, user.id))).limit(1);
  if (!agent) return NextResponse.json({ ok: false, error: "agent not found" }, { status: 404 });
  if (agent.paper) return NextResponse.json({ ok: false, error: "Paper agents hold no real funds" }, { status: 400 });
  if (!user.wallet) {
    return NextResponse.json({ ok: false, error: "Add a wallet to your account first. Sign in with email or Google (we create one) or with your own wallet." }, { status: 400 });
  }

  try {
    const result = await executeWithdrawal({ connection: new Connection(RPC_URL, "confirmed"), agent: loadAgentKeypair(agent.walletSecretEnc), owner: new PublicKey(user.wallet), request });
    // One row per moved asset, each tied to the transaction that carried it.
    await db().insert(agentTransfers).values(
      result.moved.map((m) => ({ agentId: agent.id, userId: user.id, asset: m.asset, amount: m.amount, destination: user.wallet as string, signature: m.signature })),
    );
    const [owner] = await db().select({ chat: users.telegramChatId }).from(users).where(eq(users.id, user.id)).limit(1);
    await sendAlert(owner?.chat, `Orca · ${agent.name}: withdrew ${result.moved.map((m) => `${m.amount} ${m.asset}`).join(", ")} to your wallet`);
    return NextResponse.json({ ok: true, signatures: result.signatures, moved: result.moved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "withdrawal failed" }, { status: 500 });
  }
}
