import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { dodo, productFor } from "@/lib/billing/dodo";
import { billingClosedResponse } from "@/lib/billing/flags";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const closed = billingClosedResponse();
  if (closed) return closed;
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  if (plan !== "pro" && plan !== "teams") return NextResponse.json({ ok: false, error: "invalid plan" }, { status: 400 });
  if (user.plan === plan) return NextResponse.json({ ok: false, error: `Already on the ${plan} plan` }, { status: 409 });

  try {
    const session = await dodo().checkoutSessions.create({
      product_cart: [{ product_id: productFor(plan), quantity: 1 }],
      customer: user.email ? { email: user.email, name: user.email } : undefined,
      // The webhook maps the subscription back to the user through this.
      metadata: { userId: user.id },
      return_url: `${req.nextUrl.origin}/billing?status=success`,
    });
    return NextResponse.json({ ok: true, url: session.checkout_url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "checkout failed" }, { status: 500 });
  }
}
