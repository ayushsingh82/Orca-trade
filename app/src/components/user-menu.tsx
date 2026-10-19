"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePrivyLogout } from "@/components/privy-provider";

type Me = { email: string | null; wallet: string | null; plan: string } | null;

export function UserMenu() {
  const router = useRouter();
  const privyLogout = usePrivyLogout();
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => setMe(j.user ?? null))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return null;
  if (!me) {
    return (
      <Link
        href="/login"
        className="rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Sign in
      </Link>
    );
  }
  const label = me.email ?? `${me.wallet?.slice(0, 4)}…${me.wallet?.slice(-4)}`;
  return (
    <div className="rounded-lg border bg-card p-3 text-xs">
      <p className="truncate text-foreground">{label}</p>
      <p className="mt-0.5 text-muted-foreground">{me.plan} plan</p>
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          await privyLogout().catch(() => {});
          router.push("/");
          router.refresh();
        }}
        className="mt-2 text-muted-foreground underline hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
