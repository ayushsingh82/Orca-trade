import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { verifyUsdcPayment } from "@/lib/billing/usdc";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "payment id required" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await verifyUsdcPayment(user, id)) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "verification failed" }, { status: 400 });
  }
}
