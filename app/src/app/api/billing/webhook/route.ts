import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ACTIVE_STATUSES, planForPrice, stripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/** Applies a subscription's state to the owning user. Unknown prices or inactive statuses fall back to free. */
async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const plan = ACTIVE_STATUSES.has(sub.status) ? planForPrice(sub.items.data[0]?.price.id) : null;
  await db()
    .update(users)
    .set({ plan: plan ?? "free", stripeSubscriptionId: plan ? sub.id : null })
    .where(eq(users.stripeCustomerId, customerId));
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 400 });

  let event: Stripe.Event;
  try {
    // The raw body is required for signature verification.
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        await applySubscription(await stripe().subscriptions.retrieve(session.subscription));
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await applySubscription(event.data.object as Stripe.Subscription);
    }
  } catch {
    // Non-2xx makes Stripe retry, which is what we want for transient failures.
    return NextResponse.json({ ok: false, error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
