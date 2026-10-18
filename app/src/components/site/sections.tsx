import Link from "next/link";
import { Bot, Brain, Check, FileSearch, Gauge, Newspaper, Rocket, Scale, ShieldCheck } from "lucide-react";
import { AGENT_LIMITS, LIMITS } from "@/lib/entitlements";

const section = "mx-auto max-w-6xl px-4 py-20 sm:px-6";

function Heading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-muted-foreground">{body}</p>}
    </div>
  );
}

const STEPS = [
  { icon: Brain, name: "Intelligence", text: "Live news, sector, flow and macro data become ranked, cited signals." },
  { icon: Bot, name: "Agents", text: "A strategy reads the signals and proposes a trade, or nothing." },
  { icon: Scale, name: "Risk Engine", text: "Deterministic code checks caps, slippage, conviction and contradictions." },
  { icon: Rocket, name: "Execution", text: "A swap on Solana, simulated first, sent only if you allow it." },
];

export function Pipeline() {
  return (
    <section id="how" className={section}>
      <Heading eyebrow="How it works" title="The AI proposes. Plain code disposes." body="No model output reaches a wallet without passing the Risk Engine." />
      <div className="grid gap-4 md:grid-cols-4">
        {STEPS.map(({ icon: Icon, name, text }, i) => (
          <div key={name} className="relative rounded-xl border bg-card p-5">
            <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
            <Icon className="mt-3 size-6 text-accent" />
            <h3 className="mt-3 font-display text-lg font-semibold">{name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Newspaper, title: "Opportunities", text: "Assets ranked by conviction, with the reasons, cited headlines and the evidence that disagrees." },
  { icon: FileSearch, title: "Ask Orca", text: "Cited answers grounded in live data. Contradictions are shown, not hidden." },
  { icon: Bot, title: "Agents", text: "Momentum and Narrative Rotation templates, each with its own limits and a mode: observe, propose or autonomous." },
  { icon: Gauge, title: "Paper trading", text: "Prove a strategy on a virtual $1,000 filled at real quotes before risking anything." },
  { icon: ShieldCheck, title: "Decision records", text: "Every run saves the data it saw, the reasoning, the risk checks and the result. Share one with a link." },
  { icon: Rocket, title: "Alerts", text: "Telegram messages on every execution and every blocked action." },
];

export function Features() {
  return (
    <section id="features" className={section}>
      <Heading eyebrow="Features" title="Everything between insight and action" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-card p-6 transition-colors hover:bg-muted">
            <Icon className="size-5 text-accent" />
            <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const SAFETY = [
  "Real sending is off by default. Swaps are quoted and simulated against mainnet first.",
  "Price guard: a quote far from an independent reference price is refused.",
  "Approving a queued trade re-runs the Risk Engine on fresh balances.",
  "Kill switches per agent and for the whole platform.",
  "Real data only. If a source is down you see an error, never an invented number.",
  "Not financial advice. Start with paper trading and small amounts.",
];

export function Safety() {
  return (
    <section id="safety" className={section}>
      <Heading eyebrow="Safety" title="Limits that are enforced, not promised" />
      <ul className="mx-auto grid max-w-3xl gap-3">
        {SAFETY.map((s) => (
          <li key={s} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" />
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

const PLANS = [
  { id: "free", name: "Free", price: "$0", blurb: "Paper trading and observe mode" },
  { id: "pro", name: "Pro", price: "$29/mo", blurb: "Live agents, propose and autonomous modes, alerts" },
  { id: "teams", name: "Teams", price: "$199/mo", blurb: "More agents and unlimited Ask" },
] as const;

export function Pricing() {
  return (
    <section id="pricing" className={section}>
      <Heading eyebrow="Pricing" title="Start free, pay when you go live" body="Orca takes no cut of your trades and no performance fee." />
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const ask = LIMITS[p.id].ask;
          return (
            <div key={p.id} className={`rounded-xl border bg-card p-6 ${p.id === "pro" ? "border-accent" : ""}`}>
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="mt-1 text-3xl font-semibold">{p.price}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li>{ask === null ? "Unlimited" : ask} Ask Orca per day</li>
                <li>
                  {AGENT_LIMITS[p.id]} agent{AGENT_LIMITS[p.id] > 1 ? "s" : ""}
                </li>
              </ul>
              <Link href="/login" className="mt-5 block rounded-lg border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-muted">
                {p.id === "free" ? "Get started" : `Choose ${p.name}`}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const FAQ = [
  ["Does Orca hold my funds?", "No. Your own wallet is never given to Orca. Each live agent has its own signer that holds only the amount you send it."],
  ["Can the AI trade on its own?", "Only in autonomous mode, only inside your limits, and only after the Risk Engine approves. Observe and propose modes never trade without you."],
  ["Is the data real?", "Yes. Orca reads live market, news and on-chain quote data. If a source is unavailable you see an error, not a made-up number."],
  ["Do the signals make money?", "Not proven. Our own backtest found nothing statistically significant, so conviction is a ranking, not a probability. Use paper trading to test."],
  ["How do I pay?", "Card subscriptions, or USDC on Solana."],
];

export function Faq() {
  return (
    <section id="faq" className={`${section} max-w-3xl`}>
      <Heading eyebrow="FAQ" title="Questions" />
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-xl border bg-card p-4">
            <summary className="cursor-pointer list-none text-sm font-medium">{q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className={`${section} text-center`}>
      <div className="rounded-2xl border bg-card px-6 py-14">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">See what the market is telling you</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">The board is live and needs no signup.</p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">
          Open the board
        </Link>
      </div>
    </section>
  );
}
