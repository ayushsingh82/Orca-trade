import DodoPayments from "dodopayments";
import type { Plan } from "@/lib/entitlements";

let client: DodoPayments | null = null;

export function dodo() {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
  if (!bearerToken) throw new Error("Dodo billing is not configured (missing DODO_PAYMENTS_API_KEY)");
  return (client ??= new DodoPayments({
    bearerToken,
    environment: process.env.DODO_PAYMENTS_ENV === "test_mode" ? "test_mode" : "live_mode",
  }));
}

export function dodoEnabled() {
  return Boolean(process.env.DODO_PAYMENTS_API_KEY);
}

const PRODUCTS: { plan: Exclude<Plan, "free">; env: string }[] = [
  { plan: "pro", env: "DODO_PRODUCT_PRO" },
  { plan: "teams", env: "DODO_PRODUCT_TEAMS" },
];

export function productFor(plan: Exclude<Plan, "free">): string {
  const entry = PRODUCTS.find((p) => p.plan === plan);
  const id = entry && process.env[entry.env];
  if (!id) throw new Error(`Missing ${entry?.env ?? "product"} for the ${plan} plan`);
  return id;
}

/** Maps a Dodo product id back to our plan; unknown products never grant access. */
export function planForProduct(productId: string | undefined): Plan | null {
  if (!productId) return null;
  return PRODUCTS.find((p) => process.env[p.env] === productId)?.plan ?? null;
}

/** Subscription events that grant or keep paid access. */
export const GRANT_EVENTS = new Set(["subscription.active", "subscription.renewed", "subscription.plan_changed"]);
/** Subscription events that end paid access. */
export const REVOKE_EVENTS = new Set(["subscription.cancelled", "subscription.expired", "subscription.on_hold", "subscription.failed"]);
