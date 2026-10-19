"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

/** Email or Google sign-in through Privy. Privy creates the user's Solana wallet; Orca then starts its own session. */
export function PrivyLogin({ refCode }: { refCode?: string }) {
  const router = useRouter();
  const { ready, authenticated, login, getAccessToken, logout } = usePrivy();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const exchanged = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || exchanged.current) return;
    exchanged.current = true;
    setBusy(true);
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/auth/privy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, ref: refCode }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Sign-in failed");
        router.push("/dashboard");
        router.refresh();
      } catch (e) {
        // Let the user try again from a clean Privy session.
        await logout().catch(() => {});
        exchanged.current = false;
        setError(e instanceof Error ? e.message : "Sign-in failed");
        setBusy(false);
      }
    })();
  }, [ready, authenticated, getAccessToken, logout, refCode, router]);

  return (
    <div className="space-y-2">
      <button
        onClick={() => {
          setError(null);
          login();
        }}
        disabled={!ready || busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Signing you in…" : "Continue with email or Google"}
      </button>
      <p className="text-xs text-muted-foreground">New here? We create a Solana wallet for you at sign-up. You can fund it and use it with your agents.</p>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
    </div>
  );
}
