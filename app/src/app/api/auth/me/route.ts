import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { LIMITS } from "@/lib/entitlements";
import { used } from "@/lib/entitlements";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: true, user: null });
  const askUsed = await used(user.id, "ask");
  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, wallet: user.wallet, plan: user.plan },
    limits: LIMITS[user.plan],
    usage: { ask: askUsed },
  });
}
