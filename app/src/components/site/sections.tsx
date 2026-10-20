import Link from "next/link";
import {
  ArrowDownToLine, BarChart3, Bot, Brain, Check, Coins, FileSearch, Gauge, Layers, Newspaper, Rocket, Scale, Search, ShieldCheck, Star, TrendingUp, Wallet,
} from "lucide-react";
import { billingOpen } from "@/lib/billing/flags";
import { AGENT_LIMITS, LIMITS } from "@/lib/entitlements";
import { TRADABLE } from "@/lib/exec/mints";
import { BetaLink } from "@/components/beta-link";

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

/** Facts that come straight from the product, so the numbers cannot drift from what is built. */
export function Stats() {
  const items = [
    ["50+", "tokens ranked, plus search across every listed coin"],
    [`${TRADABLE.length}`, "reviewed Solana tokens agents can trade"],
    ["4", "RSI timeframes: 1h, 4h, 24h and 7d"],
    ["3", "agent strategies, ready in one click"],
  ];
  return (
    <section className="border-y bg-card/40">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
        {items.map(([n, label]) => (
          <div key={label} className="text-center">
            <dt className="font-display text-4xl font-semibold text-accent">{n}</dt>
            <dd className="mt-1 text-xs text-muted-foreground">{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const JOURNEY = [
  { icon: Wallet, title: "Sign up", text: "Email or Google. We create a Solana wallet for you." },
  { icon: ArrowDownToLine, title: "Fund it", text: "Add funds by card or crypto, or send USDC to your address." },
  { icon: Bot, title: "Pick an agent and tokens", text: "Start from a template, choose the tokens it may trade, set the caps." },
  { icon: TrendingUp, title: "Watch and withdraw", text: "Follow every decision in your portfolio. Take funds back any time." },
];

export function Journey() {
  return (
    <section id="how" className={section}>
      <Heading eyebrow="How it works" title="From sign-up to a working agent in minutes" body="Start free with paper trading. Go live only when you are ready." />
      <ol className="grid gap-4 md:grid-cols-4">
        {JOURNEY.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="relative rounded-xl border bg-card p-5">
            <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
            <Icon className="mt-3 size-6 text-accent" />
            <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const MARKET_FEATURES = [
  { icon: Layers, title: "Top 50 and Solana ecosystem", text: "Price, 1h, 24h and 7d change, market cap, volume and a 7-day chart. Stablecoins hidden by default." },
  { icon: Search, title: "Search any token", text: "Find any coin by name or symbol, see its price, RSI and whether agents can trade it." },
  { icon: Star, title: "Follow your tokens", text: "Star the tokens you care about and keep them in one list." },
  { icon: BarChart3, title: "RSI on four timeframes", text: "1h, 4h, 24h and 7d, with oversold and overbought zones and a one-line read." },
  { icon: Newspaper, title: "News with measured impact", text: "Headlines with the price reaction after publication, and how fast it fades." },
  { icon: FileSearch, title: "Ask Orca", text: "Cited answers grounded in live data. The evidence that disagrees is shown, not hidden." },
];

export function Research() {
  return (
    <section id="features" className={section}>
      <Heading eyebrow="Research" title="Understand a token before you risk a cent" body="Everything runs on live data. If a source is down you see an error, never an invented number." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MARKET_FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-card p-6 transition-colors hover:bg-muted">
            <Icon className="size-5 text-accent" />
            <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Link href="/markets" className="text-sm text-accent underline">Open the markets →</Link>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Brain, name: "Intelligence", text: "Live prices, trend, news and RSI become ranked signals." },
  { icon: Bot, name: "Agents", text: "A strategy reads the signals and proposes a trade, or nothing." },
  { icon: Scale, name: "Risk Engine", text: "Plain code checks caps, slippage, conviction and contradictions." },
  { icon: Rocket, name: "Execution", text: "A Jupiter swap on Solana, simulated first, sent only if you allow it." },
];

export function Agents() {
  return (
    <section id="agents" className={`${section} pt-0`}>
      <Heading eyebrow="Agents" title="The AI proposes. Plain code disposes." body="No model output reaches a wallet without passing the Risk Engine." />
      <div className="grid gap-4 md:grid-cols-4">
        {STEPS.map(({ icon: Icon, name, text }, i) => (
          <div key={name} className="rounded-xl border bg-card p-5">
            <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
            <Icon className="mt-3 size-6 text-accent" />
            <h3 className="mt-3 font-display text-lg font-semibold">{name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["Momentum Scout", "Follows the strongest 7d and 14d trend confirmed by news."],
          ["News Rotator", "Only acts on moves backed by fresh headlines."],
          ["RSI Dip Watcher", "Flags oversold dips inside a healthy trend, and overbought exits."],
        ].map(([n, t]) => (
          <div key={n} className="rounded-xl border bg-card p-5">
            <p className="font-medium">{n}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t}</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">One click · paper · reports live data</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
        Choose exactly which tokens each agent may trade. Large caps are on by default. Memecoins are an explicit opt-in and are marked high risk.
      </p>
    </section>
  );
}

const MONEY = [
  { icon: Wallet, title: "Your own wallet", text: "Created at sign-up. Fund it by card, crypto or a plain transfer." },
  { icon: Gauge, title: "Caps you control", text: "Per-trade and daily limits, slippage, minimum conviction and kill switches. An agent only holds what you send it." },
  { icon: ShieldCheck, title: "Optional on-chain cap", text: "Keep funds in a vault only you control. The agent can pull at most a daily limit, enforced by the Solana program." },
  { icon: ArrowDownToLine, title: "Withdraw any time", text: "Take USDC, SOL or everything back. Funds can only go to your own wallet." },
  { icon: TrendingUp, title: "A real portfolio", text: "Total value, realized and unrealized profit, win rate, allocation, equity curves and a CSV export." },
  { icon: Coins, title: "Paper first", text: "A virtual $1,000 filled at real Jupiter quotes, so you can prove a strategy before any real money." },
];

export function Money() {
  return (
    <section id="money" className={`${section} pt-0`}>
      <Heading eyebrow="Your money" title="Invest with limits, and always keep the way out" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MONEY.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-card p-6">
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
  "Live trading is off by default. Swaps are quoted and simulated against mainnet first.",
  "Agents can only trade a short reviewed list of Solana tokens, so a fake contract address can never be traded.",
  "Price guard: a quote far from an independent reference price is refused, and thin pools are refused.",
  "Approving a queued trade re-runs the Risk Engine on fresh balances.",
  "Real data only. If a source is down you see an error, never an invented number.",
  "Not financial advice. Our own backtest found no proven edge in the signals, so treat them as a ranking, not a prediction.",
];

export function Safety() {
  return (
    <section id="safety" className={`${section} pt-0`}>
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
  const open = billingOpen();
  return (
    <section id="pricing" className={section}>
      <Heading
        eyebrow="Pricing"
        title={open ? "Start free, pay when you go live" : "Free today. Paid plans open with the beta."}
        body="Orca takes no cut of your trades and no performance fee."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const ask = LIMITS[p.id].ask;
          const upcoming = !open && p.id !== "free";
          return (
            <div key={p.id} className={`relative rounded-xl border bg-card p-6 ${p.id === "pro" ? "border-accent" : ""}`}>
              <span
                className={`absolute right-4 top-4 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${upcoming ? "border-amber-400/40 text-amber-300" : "border-emerald-400/40 text-emerald-300"}`}
              >
                {upcoming ? "Upcoming · Beta" : "Available now"}
              </span>
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="mt-1 text-3xl font-semibold">{upcoming ? "Coming soon" : p.price}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li>{ask === null ? "Unlimited" : ask} Ask Orca per day</li>
                <li>{AGENT_LIMITS[p.id]} agent{AGENT_LIMITS[p.id] > 1 ? "s" : ""}</li>
                <li>Top 50, Solana and token search</li>
                <li>RSI on four timeframes</li>
              </ul>
              {upcoming ? (
                <span aria-disabled="true" className="mt-5 block cursor-not-allowed rounded-lg border px-4 py-2 text-center text-sm font-medium opacity-60">
                  Coming soon
                </span>
              ) : (
                <BetaLink className="mt-5 block rounded-lg border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-muted">
                  {p.id === "free" ? "Get started" : `Choose ${p.name}`}
                </BetaLink>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const FAQ = [
  ["Does Orca hold my funds?", "No. You get your own wallet. Each live agent has its own separate wallet that only holds what you send it, and you can withdraw it back to your wallet at any time."],
  ["Which tokens can I research, and which can agents trade?", "You can research the top 50 and search any listed coin. Agents trade a short reviewed list of Solana tokens with enough liquidity, and you choose which ones each agent may use."],
  ["Can the AI trade on its own?", "Only in autonomous mode, only inside your limits, and only after the Risk Engine approves. Observe and propose modes never trade without you."],
  ["Is the data real?", "Yes. Orca reads live market, news and on-chain quote data. If a source is unavailable you see an error, not a made-up number."],
  ["Do the signals make money?", "Not proven. Our own backtest found nothing statistically significant, so conviction is a ranking, not a probability. Use paper trading to test."],
  ["Is Orca free?", "Yes, the Free plan is open now: markets, research, sentiment, paper trading and observe-only agents. Pro and Teams are upcoming with the beta."],
];

export function Faq() {
  return (
    <section id="faq" className={`${section} max-w-3xl`}>
      <Heading eyebrow="FAQ" title="Questions" />
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-xl border bg-card transition-colors open:border-white/20 hover:border-white/15">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden className="relative size-7 shrink-0 rounded-full border transition-colors group-open:bg-muted">
                <span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-foreground transition-transform duration-200 group-open:rotate-45" />
                <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-foreground transition-transform duration-200 group-open:rotate-45" />
              </span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className={`${section} text-center`}>
      <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-16 sm:py-20">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
        <p className="relative font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Paper trading · no funds at risk</p>
        <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">Start with paper trading. It takes a minute.</h2>
        <p className="relative mx-auto mt-4 max-w-md text-muted-foreground">Get a wallet, add a starter agent, and watch it work on live data. No funds at risk.</p>
        <div className="relative mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <BetaLink className="rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
            Create your account
          </BetaLink>
          <Link href="/markets" className="rounded-lg border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted">
            Browse markets
          </Link>
        </div>
      </div>
    </section>
  );
}
