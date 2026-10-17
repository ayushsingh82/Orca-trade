"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Payment = { id: string; recipient: string; amount: number; reference: string; payUrl: string };

/** Pay a plan in USDC on Solana: start a payment, pay from any wallet, then verify on-chain. */
export function UsdcPay() {
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, body: unknown) {
    const json = await (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    if (!json.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function start(plan: "pro" | "teams") {
    setBusy(true);
    setMsg(null);
    try {
      setPayment((await call("/api/billing/usdc/start", { plan })).payment);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!payment) return;
    setBusy(true);
    try {
      const r = await call("/api/billing/usdc/verify", { id: payment.id });
      if (r.paid) {
        setMsg("Payment confirmed. Your plan is active for 30 days.");
        setPayment(null);
        router.refresh();
      } else {
        setMsg("No confirmed payment found yet. Wait a few seconds after paying and try again.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Pay with USDC on Solana</h2>
      <p className="mt-1 text-xs text-muted-foreground">30 days per payment. No card needed; verified on-chain.</p>
      {!payment ? (
        <div className="mt-3 flex gap-2">
          <button disabled={busy} onClick={() => start("pro")} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Pay for Pro
          </button>
          <button disabled={busy} onClick={() => start("teams")} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Pay for Teams
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-xs">
          <p>
            Send exactly <span className="font-mono text-foreground">{payment.amount} USDC</span> to
          </p>
          <p className="break-all font-mono text-foreground">{payment.recipient}</p>
          <p className="text-muted-foreground">
            Include reference <span className="break-all font-mono">{payment.reference}</span> (the link below does it for you). The window is 1 hour.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={payment.payUrl} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
              Open in wallet
            </a>
            <button disabled={busy} onClick={verify} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
              {busy ? "Checking…" : "I've paid, verify"}
            </button>
          </div>
        </div>
      )}
      {msg && <p className="mt-3 font-mono text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}
