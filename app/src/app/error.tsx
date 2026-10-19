"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <BrandLogo />
      <p className="mt-8 font-mono text-xs uppercase tracking-[0.25em] text-accent">Something broke</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">That did not load</h1>
      <p className="mt-2 text-sm text-muted-foreground">A data source may be slow or unavailable. Nothing was traded. Try again in a moment.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
          Try again
        </button>
        <Link href="/" className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
          Home
        </Link>
      </div>
    </div>
  );
}
