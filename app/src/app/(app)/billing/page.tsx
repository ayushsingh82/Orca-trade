import Link from "next/link";
import { BillingButton } from "@/components/billing-buttons";
import { PageHeader } from "@/components/page-header";
import { ensureReferralCode } from "@/lib/auth/referral";
import { getUser } from "@/lib/auth/session";
import { AGENT_LIMITS, LIMITS, type Plan } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLANS: { id: Plan; name: string; price: string; blurb: string }[] = [
  { id: "free", name: "Free", price: "$0", blurb: "Paper trading and observe mode" },
  { id: "pro", name: "Pro", price: "$29/mo", blurb: "Live agents, propose and autonomous modes, alerts" },
  { id: "teams", name: "Teams", price: "$199/mo", blurb: "More agents and unlimited Ask" },
];

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await getUser();
  const { status } = await searchParams;
  if (!user) {
    return (
      <>
        <PageHeader title="Billing" description="Sign in to manage your plan." />
        <Link href="/login" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          Sign in
        </Link>
      </>
    );
  }
  const referralCode = await ensureReferralCode(user);
  return (
    <>
      <PageHeader title="Billing" description={`You are on the ${user.plan} plan.`} />
      {status === "success" && (
        <p className="mb-4 text-sm text-emerald-400">Payment received. Your plan updates as soon as Stripe confirms it.</p>
      )}
      {status === "cancelled" && <p className="mb-4 text-sm text-muted-foreground">Checkout cancelled. Nothing was charged.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const ask = LIMITS[p.id].ask;
          return (
            <section key={p.id} className={cn("rounded-xl border bg-card p-5", user.plan === p.id && "border-accent")}>
              <h2 className="font-display text-xl font-semibold">{p.name}</h2>
              <p className="mt-1 text-2xl font-semibold">{p.price}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
              <ul className="mt-3 space-y-1 text-sm">
                <li>{ask === null ? "Unlimited" : ask} Ask Orca per day</li>
                <li>{AGENT_LIMITS[p.id]} agent{AGENT_LIMITS[p.id] > 1 ? "s" : ""}</li>
              </ul>
              <div className="mt-4">
                {user.plan === p.id ? (
                  <span className="text-xs text-muted-foreground">Current plan</span>
                ) : p.id === "free" ? null : (
                  <BillingButton endpoint="/api/billing/checkout" body={{ plan: p.id }} label={`Upgrade to ${p.name}`} />
                )}
              </div>
            </section>
          );
        })}
      </div>
      {user.stripeCustomerId && (
        <div className="mt-6">
          <BillingButton endpoint="/api/billing/portal" label="Manage subscription" />
        </div>
      )}
      <section className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Invite friends</h2>
        <p className="mt-1 text-xs text-muted-foreground">Share your link. Sign-ups through it are recorded against your account.</p>
        <p className="mt-2 break-all font-mono text-xs">/login?ref={referralCode}</p>
      </section>
    </>
  );
}