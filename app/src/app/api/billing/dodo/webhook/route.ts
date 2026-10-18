import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { grantReferralReward } from "@/lib/billing/rewards";
import { dodo, GRANT_EVENTS, planForProduct, REVOKE_EVENTS } from "@/lib/billing/dodo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const key = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 400 });

  const body = await req.text(); // the raw body is required for signature verification
  let event: ReturnType<ReturnType<typeof dodo>["webhooks"]["unwrap"]>;
  try {
    event = dodo().webhooks.unwrap(body, {
      headers: {
        "webhook-id": req.headers.get("webhook-id") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
      },
      key,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  try {
    if (GRANT_EVENTS.has(event.type) || REVOKE_EVENTS.has(event.type)) {
      const sub = event.data as { subscription_id: string; product_id: string; metadata?: Record<string, string> };
      const grant = GRANT_EVENTS.has(event.type);
      const plan = grant ? planForProduct(sub.product_id) : null;
      const owner = sub.metadata?.userId
        ? eq(users.id, sub.metadata.userId)
        : eq(users.dodoSubscriptionId, sub.subscription_id);
      const [updated] = await db()
        .update(users)
        .set(plan ? { plan, dodoSubscriptionId: sub.subscription_id } : { plan: "free", dodoSubscriptionId: null })
        .where(owner)
        .returning({ id: users.id });
      if (plan && updated) await grantReferralReward(updated.id);
    }
  } catch {
    // Non-2xx makes Dodo retry, which is what we want for transient failures.
    return NextResponse.json({ ok: false, error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
