import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { usage, type User } from "@/db/schema";

export type Plan = User["plan"];
export type Metric = "ask";

/** Max agents per plan. */
export const AGENT_LIMITS: Record<Plan, number> = { free: 1, pro: 5, teams: 25 };

/** Per-day limits by plan. `null` = unlimited (fair use). Placeholder numbers per PLAN.md. */
export const LIMITS: Record<Plan, Record<Metric, number | null>> = {
  free: { ask: 5 },
  pro: { ask: 100 },
  teams: { ask: null },
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Atomically consumes one unit of `metric` for the user. Returns whether it was
 * allowed and what remains. A single guarded upsert avoids read-then-write races.
 */
export async function consume(user: Pick<User, "id" | "plan">, metric: Metric) {
  const limit = LIMITS[user.plan][metric];
  if (limit === null) return { allowed: true, remaining: null as number | null };

  const rows = await db()
    .insert(usage)
    .values({ userId: user.id, metric, day: today(), count: 1 })
    .onConflictDoUpdate({
      target: [usage.userId, usage.metric, usage.day],
      set: { count: sql`${usage.count} + 1` },
      setWhere: sql`${usage.count} < ${limit}`,
    })
    .returning({ count: usage.count });

  if (rows.length === 0) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: limit - rows[0].count };
}

export async function used(userId: string, metric: Metric) {
  const [row] = await db()
    .select({ count: usage.count })
    .from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.metric, metric), eq(usage.day, today())));
  return row?.count ?? 0;
}
