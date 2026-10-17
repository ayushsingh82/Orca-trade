import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { runAgent } from "@/lib/agents/runner";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_req: Request, ctx: RouteContext<"/api/agents/[id]/run">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const [agent] = await db().select().from(agents).where(and(eq(agents.id, id), eq(agents.userId, user.id))).limit(1);
  if (!agent) return NextResponse.json({ ok: false, error: "agent not found" }, { status: 404 });
  try {
    return NextResponse.json({ ok: true, decision: await runAgent(agent) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "run failed" }, { status: 500 });
  }
}
