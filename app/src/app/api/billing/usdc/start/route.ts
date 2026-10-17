import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { startUsdcPayment } from "@/lib/billing/usdc";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  if (plan !== "pro" && plan !== "teams") return NextResponse.json({ ok: false, error: "invalid plan" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, payment: await startUsdcPayment(user, plan) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "could not start payment" }, { status: 400 });
  }
}
