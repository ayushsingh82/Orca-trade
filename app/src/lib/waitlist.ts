/** Pure validation for the waitlist form, shared by the API and its tests. */
export type WaitlistInput = { email: string; plan: "pro" | "teams" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseWaitlist(body: unknown): WaitlistInput | string {
  const b = (body ?? {}) as { email?: unknown; plan?: unknown };
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) return "Enter a valid email address";
  const plan = b.plan === "teams" ? "teams" : "pro";
  return { email, plan };
}
