import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Owner-only opt-in to the public leaderboard. Only paper agents can be listed. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/agents/[id]/list">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const { listed } = (await req.json().catch(() => ({}))) as { listed?: boolean };
  const [agent] = await db().select().from(agents).where(and(eq(agents.id, id), eq(agents.userId, user.id))).limit(1);
  if (!agent) return NextResponse.json({ ok: false, error: "agent not found" }, { status: 404 });
  if (!agent.paper) return NextResponse.json({ ok: false, error: "Only paper agents can be listed publicly" }, { status: 400 });
  await db().update(agents).set({ listed: listed !== false }).where(eq(agents.id, id));
  return NextResponse.json({ ok: true });
}
