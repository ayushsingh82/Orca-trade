import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, decisions } from "@/db/schema";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Owner-only toggle that makes a single decision viewable at /d/[id]. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/decisions/[id]/share">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const { shared } = (await req.json().catch(() => ({}))) as { shared?: boolean };
  const [owned] = await db()
    .select({ id: decisions.id })
    .from(decisions)
    .innerJoin(agents, eq(decisions.agentId, agents.id))
    .where(and(eq(decisions.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!owned) return NextResponse.json({ ok: false, error: "decision not found" }, { status: 404 });
  await db().update(decisions).set({ shared: shared !== false }).where(eq(decisions.id, id));
  return NextResponse.json({ ok: true, url: `${req.nextUrl.origin}/d/${id}` });
}
