import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Lock, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

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
        <Float className="left-[4%] top-[20%] -rotate-[6deg]" duration={7}>
          <div className={cn(card, "w-56")}>
            <ShieldCheck className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">Risk check before every trade</p>
            <p className="mt-1 text-xs text-muted-foreground">Plain code, not the model, has the final say.</p>
          </div>
        </Float>
        <Float className="right-[4%] top-[16%] rotate-[5deg]" duration={9} delay={1}>
          <div className={cn(card, "w-56")}>
            <Zap className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">Paper trade first</p>
            <p className="mt-1 text-xs text-muted-foreground">A virtual $1,000 filled at real market quotes.</p>
          </div>
        </Float>
        <Float className="right-[8%] bottom-[14%] -rotate-[4deg]" duration={8} delay={2}>
          <div className={cn(card, "w-56")}>
            <Lock className="size-5 text-accent" />
            <p className="mt-3 text-sm font-medium">Non-custodial</p>
            <p className="mt-1 text-xs text-muted-foreground">An agent only holds what you fund it with.</p>
          </div>
        </Float>
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-32 pt-24 text-center sm:px-6 sm:pt-32 sm:pb-44">
        <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent" />
          Live on Solana · real data only
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
          AI trading agents that show their work
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Orca finds the opportunity, explains why with cited evidence, and trades on Solana only inside the limits you set.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
            Explore opportunities <ArrowRight className="size-4" />
          </Link>
          <a href="#how" className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted">
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}
