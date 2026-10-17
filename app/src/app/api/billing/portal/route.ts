import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { stripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  if (!user.stripeCustomerId) return NextResponse.json({ ok: false, error: "No billing account yet" }, { status: 404 });
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${req.nextUrl.origin}/billing`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portal failed" }, { status: 500 });
  }
}
