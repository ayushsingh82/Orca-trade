import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Coins, Lock, ShieldCheck, Wallet } from "lucide-react";
import { TRADABLE } from "@/lib/exec/mints";
import { cn } from "@/lib/utils";
import { BetaLink } from "@/components/beta-link";

const card = "rounded-2xl border bg-card p-4 shadow-[0_24px_60px_-15px] shadow-black/50 ring-1 ring-white/10";

function Float({ className, duration = 8, delay = 0, children }: { className?: string; duration?: number; delay?: number; children: ReactNode }) {
  return (
    <div className={cn("absolute hidden lg:block", className)}>
      <div className="animate-[float_var(--d)_ease-in-out_infinite]" style={{ "--d": `${duration}s`, animationDelay: `${delay}s` } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <Float className="left-[3%] top-[22%] -rotate-[6deg]" duration={7}>
          <div className={cn(card, "w-56")}>
            <Wallet className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">A wallet at sign-up</p>
            <p className="mt-1 text-xs text-muted-foreground">Sign in with email or Google. Your Solana wallet is created for you.</p>
          </div>
        </Float>
        <Float className="right-[3%] top-[16%] rotate-[5deg]" duration={9} delay={1}>
          <div className={cn(card, "w-56")}>
            <Coins className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">Top 50 and Solana tokens</p>
            <p className="mt-1 text-xs text-muted-foreground">Search any coin. Agents trade {TRADABLE.length} reviewed Solana tokens.</p>
          </div>
        </Float>
        <Float className="left-[6%] bottom-[12%] rotate-[3deg]" duration={8} delay={2}>
          <div className={cn(card, "w-56")}>
            <ShieldCheck className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">Limits you set</p>
            <p className="mt-1 text-xs text-muted-foreground">Per-trade and daily caps, a risk check before every trade.</p>
          </div>
        </Float>
        <Float className="right-[6%] bottom-[10%] -rotate-[4deg]" duration={8} delay={3}>
          <div className={cn(card, "w-56")}>
            <Lock className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">Withdraw any time</p>
            <p className="mt-1 text-xs text-muted-foreground">Funds only ever go back to your own wallet.</p>
          </div>
        </Float>
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-24 text-center sm:px-6 sm:pt-32 sm:pb-40">
        <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent" />
          Beta · live on Solana · real data only
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
          Research any token. Let AI agents trade it inside your limits.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Orca tracks the top 50 and the Solana ecosystem, explains every move with cited evidence and RSI, and runs agents that trade on Solana only within the caps you set.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <BetaLink className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
            Get started free <ArrowRight className="size-4" />
          </BetaLink>
          <Link href="/markets" className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted">
            Explore markets
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">No card needed. Start with paper trading and a virtual $1,000.</p>
      </div>
    </section>
  );
}
