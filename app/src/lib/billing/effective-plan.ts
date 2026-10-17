import type { User } from "@/db/schema";
import type { Plan } from "@/lib/entitlements";

const RANK: Record<Plan, number> = { free: 0, pro: 1, teams: 2 };

/**
 * The plan a user is actually entitled to right now. Combines the stored plan (Stripe or USDC, the latter
 * lapsing at `planExpiresAt`) with referral-earned Pro (`bonusProUntil`). Pure: takes `now` explicitly.
 */
export function effectivePlan(user: Pick<User, "plan" | "planExpiresAt" | "bonusProUntil">, now = Date.now()): Plan {
  const paid: Plan = user.planExpiresAt && user.planExpiresAt.getTime() <= now ? "free" : user.plan;
  const bonus: Plan = user.bonusProUntil && user.bonusProUntil.getTime() > now ? "pro" : "free";
  return RANK[bonus] > RANK[paid] ? bonus : paid;
}
