import Stripe from "stripe";
import type { Plan } from "@/lib/entitlements";

let client: Stripe | null = null;

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Billing is not configured (missing STRIPE_SECRET_KEY)");
  return (client ??= new Stripe(key));
}

/** Paid plans and the Stripe Price each one maps to. */
export const PAID_PLANS: { plan: Exclude<Plan, "free">; envPrice: string }[] = [
  { plan: "pro", envPrice: "STRIPE_PRICE_PRO" },
  { plan: "teams", envPrice: "STRIPE_PRICE_TEAMS" },
];

export function priceFor(plan: Exclude<Plan, "free">): string {
  const entry = PAID_PLANS.find((p) => p.plan === plan);
  const id = entry && process.env[entry.envPrice];
  if (!id) throw new Error(`Missing ${entry?.envPrice ?? "price"} for the ${plan} plan`);
  return id;
}

/** Maps a Stripe Price id back to our plan; unknown prices never grant access. */
export function planForPrice(priceId: string | undefined): Plan | null {
  if (!priceId) return null;
  return PAID_PLANS.find((p) => process.env[p.envPrice] === priceId)?.plan ?? null;
}

/** Subscription statuses that keep paid access. */
export const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);
