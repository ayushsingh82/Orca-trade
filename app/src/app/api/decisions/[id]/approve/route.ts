import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, decisions } from "@/db/schema";
import { approveDecision } from "@/lib/agents/runner";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_req: Request, ctx: RouteContext<"/api/decisions/[id]/approve">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  // Ownership is enforced by joining through the agent.
  const [row] = await db()
    .select({ decision: decisions, agent: agents })
    .from(decisions)
    .innerJoin(agents, eq(decisions.agentId, agents.id))
    .where(and(eq(decisions.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!row) return NextResponse.json({ ok: false, error: "decision not found" }, { status: 404 });
  try {
    return NextResponse.json({ ok: true, decision: await approveDecision(row.agent, row.decision) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "approval failed" }, { status: 400 });
  }
}
