import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <BrandLogo />
        <Link
          href="/dashboard"
          className="rounded-lg border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Open app
        </Link>
      </nav>
      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-7xl">
          Trading agents that
          <br />
          show their work.
        </h1>
        <p className="mt-6 max-w-xl text-muted-foreground">
          Orca finds the opportunity, explains why, and acts on it on-chain within limits you set.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Explore opportunities <ArrowRight className="size-4" />
        </Link>
      </main>
    </div>
  );
}
