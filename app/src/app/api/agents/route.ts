import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, STRATEGIES, type Strategy } from "@/db/schema";
import { parsePolicy } from "@/lib/agents/policy";
import { getUser } from "@/lib/auth/session";
import { AGENT_LIMITS } from "@/lib/entitlements";
import { createAgentSigner } from "@/lib/exec/signer";

export const runtime = "nodejs";

const publicAgent = (a: typeof agents.$inferSelect) => ({
  id: a.id,
  name: a.name,
  strategy: a.strategy,
  policy: a.policy,
  walletPublicKey: a.walletPublicKey,
  createdAt: a.createdAt,
});

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const rows = await db().select().from(agents).where(eq(agents.userId, user.id)).orderBy(desc(agents.createdAt));
  return NextResponse.json({ ok: true, agents: rows.map(publicAgent) });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { name?: string; strategy?: string; policy?: unknown };
  const name = body.name?.trim();
  if (!name || name.length > 60) return NextResponse.json({ ok: false, error: "name required (max 60 chars)" }, { status: 400 });
  if (!STRATEGIES.includes(body.strategy as Strategy)) return NextResponse.json({ ok: false, error: "invalid strategy" }, { status: 400 });

  const policy = parsePolicy(body.policy);
  if (typeof policy === "string") return NextResponse.json({ ok: false, error: policy }, { status: 400 });

  // Plan gating: free users can only run observe-mode agents; one agent max.
  const existing = await db().select({ id: agents.id }).from(agents).where(eq(agents.userId, user.id));
  if (existing.length >= AGENT_LIMITS[user.plan]) {
    return NextResponse.json({ ok: false, error: `Agent limit reached for the ${user.plan} plan` }, { status: 403 });
  }
  if (user.plan === "free" && policy.mode !== "observe") {
    return NextResponse.json({ ok: false, error: "Free plan agents are observe-only. Upgrade to enable propose or autonomous." }, { status: 403 });
  }

  const signer = createAgentSigner();
  const [row] = await db()
    .insert(agents)
    .values({ userId: user.id, name, strategy: body.strategy as Strategy, policy, walletPublicKey: signer.publicKey, walletSecretEnc: signer.secretEnc })
    .returning();
  return NextResponse.json({ ok: true, agent: publicAgent(row) });
}
