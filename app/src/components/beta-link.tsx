import Link from "next/link";
import type { ReactNode } from "react";

/** Sign-in and sign-up are closed until NEXT_PUBLIC_SIGNUP_ENABLED=1. */
export const SIGNUP_OPEN = process.env.NEXT_PUBLIC_SIGNUP_ENABLED === "1";

/** A link to /login that renders as a disabled "beta access coming soon" button while sign-up is closed. */
export function BetaLink({ className = "", children }: { className?: string; children: ReactNode }) {
  if (SIGNUP_OPEN) {
    return (
      <Link href="/login" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <span
      role="link"
      aria-disabled="true"
      title="Beta access coming soon"
      className={`${className} pointer-events-none inline-flex cursor-not-allowed select-none items-center justify-center gap-2 !bg-muted !text-muted-foreground ring-1 ring-inset ring-white/10`}
    >
      {children}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-amber-300">
        <span className="size-1.5 animate-pulse rounded-full bg-amber-300" />
        Beta soon
      </span>
    </span>
  );
}
