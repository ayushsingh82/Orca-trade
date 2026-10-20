import Link from "next/link";
import { ErrorCard } from "@/components/error-card";
import { BotCard } from "@/components/live/bot-card";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { getBots } from "@/lib/bots";
import { fmtAgo } from "@/lib/format";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "Live Bots" };

export default async function BotsPage() {
  let snap;
  try {
    snap = await getBots();
  } catch (e) {
    return <ErrorCard title="Could not run the bots" message={e instanceof Error ? e.message : "Unknown error"} />;
  }
  return (
    <>
      <PageHeader title="Live Bots" description="The three starter agents, running right now on live data. This is the same code your own agents run, with the same Risk Engine, but with no money and no account." />
      <SourceBadge className="-mt-4 mb-4" />
      <p className="mb-6 text-xs text-muted-foreground">
        Read {snap.signalsUsed} live signals {fmtAgo(snap.generatedAt)}. Refreshed every 5 minutes. Nothing here is traded. {" "}
        <Link href="/agents" className="text-accent underline">Run your own on the Agents page</Link>.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {snap.bots.map((b) => (
          <BotCard key={b.strategy} b={b} />
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-xs text-muted-foreground">
        A bot that wants a trade is shown with the Risk Engine&apos;s verdict and every check it ran. Most of the time there is no trade, and that is the point: they act only when the evidence and the limits line up. Our own backtest found no proven edge in the signals, so treat this as a demonstration of the process, not a recommendation.
      </p>
    </>
  );
}
