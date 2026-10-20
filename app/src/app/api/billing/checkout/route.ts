import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUser } from "@/lib/auth/session";
import { priceFor, stripe } from "@/lib/billing/stripe";
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
    const s = stripe();
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await s.customers.create({ email: user.email ?? undefined, metadata: { userId: user.id } });
      customerId = customer.id;
      await db().update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
    }
    const origin = req.nextUrl.origin;
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceFor(plan), quantity: 1 }],
      success_url: `${origin}/billing?status=success`,
      cancel_url: `${origin}/billing?status=cancelled`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "checkout failed" }, { status: 500 });
  }
}
