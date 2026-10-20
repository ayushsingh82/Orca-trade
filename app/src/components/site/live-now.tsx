"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BotCard } from "@/components/live/bot-card";
import { SentimentView } from "@/components/live/sentiment-view";
import type { BotsSnapshot } from "@/lib/bots";
import type { Sentiment } from "@/lib/sentiment";

type State<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: T };

function useLive<T>(url: string): State<T> {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setState(j.ok ? { status: "ok", data: j.data as T } : { status: "error", message: j.error ?? "Unavailable" });
      })
      .catch(() => !cancelled && setState({ status: "error", message: "Unavailable" }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

const Skeleton = ({ h }: { h: string }) => <div className={`animate-pulse rounded-xl border bg-card ${h}`} />;

/** Live market sentiment and the bots working, loaded in the browser so the page itself stays instant. */
export function LiveNow() {
  const sentiment = useLive<Sentiment>("/api/sentiment");
  const bots = useLive<BotsSnapshot>("/api/bots");
  return (
    <section id="live" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Live right now</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">See the market and the bots working</h2>
        <p className="mt-3 text-muted-foreground">Real data, refreshed every few minutes. No account needed. The bots below run the same code your agents do, with no money at risk.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-white/20">
          <h3 className="mb-4 font-display text-lg font-semibold">Market sentiment</h3>
          {sentiment.status === "loading" && <Skeleton h="h-64" />}
          {sentiment.status === "error" && <p className="text-sm text-muted-foreground">The reading is not available right now. {sentiment.message}</p>}
          {sentiment.status === "ok" && <SentimentView s={sentiment.data} compact />}
          <Link href="/sentiment" className="mt-auto inline-block pt-4 text-xs text-accent underline">How it is calculated →</Link>
        </div>
        {bots.status === "loading" && [0, 1, 2].map((i) => <Skeleton key={i} h="h-72" />)}
        {bots.status === "error" && <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">The bots are not available right now. {bots.message}</div>}
        {bots.status === "ok" && bots.data.bots.map((b) => <BotCard key={b.strategy} b={b} compact />)}
      </div>
      <p className="mt-4 text-right text-xs text-muted-foreground">
        <Link href="/bots" className="text-accent underline">See the full reasoning and risk checks →</Link>
      </p>
    </section>
  );
}
