"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import bs58 from "bs58";
import { BrandLogo } from "@/components/brand";
import { ErrorCard } from "@/components/error-card";
import { PRIVY_APP_ID } from "@/components/privy-provider";
import { PrivyLogin } from "@/components/privy-login";

type SolanaProvider = {
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (msg: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referral code from /login?ref=CODE, read at submit time (no Suspense needed).
  const refCode = () => new URLSearchParams(window.location.search).get("ref") ?? undefined;

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function onEmail(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await post(mode === "login" ? "/api/auth/login" : "/api/auth/signup", { email, password, ref: refCode() });
    });
  }

  function onWallet() {
    run(async () => {
      const provider = (window as unknown as { solana?: SolanaProvider }).solana;
      if (!provider) throw new Error("No Solana wallet found. Install Phantom or another wallet.");
      const { publicKey } = await provider.connect();
      const wallet = publicKey.toString();
      const { message, challenge } = await post("/api/auth/nonce", { wallet });
      const { signature } = await provider.signMessage(new TextEncoder().encode(message), "utf8");
      await post("/api/auth/wallet", { wallet, signature: bs58.encode(signature), challenge, ref: refCode() });
    });
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <BrandLogo />
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        {PRIVY_APP_ID && (
          <>
            <PrivyLogin refCode={typeof window === "undefined" ? undefined : refCode()} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> other ways to sign in <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <button
          onClick={onWallet}
          disabled={busy}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          Continue with Solana wallet
        </button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={onEmail} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border bg-card px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (8+ characters)"
            className="w-full rounded-lg border bg-card px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            disabled={busy}
            className="w-full rounded-lg border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {mode === "login" ? "Sign in with email" : "Sign up with email"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          {mode === "login" ? "No account? Create one" : "Have an account? Sign in"}
        </button>
        {error && <ErrorCard title="Could not sign in" message={error} />}
      </div>
    </div>
  );
}
