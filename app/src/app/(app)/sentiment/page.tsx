import Link from "next/link";
import { ErrorCard } from "@/components/error-card";
import { SentimentView } from "@/components/live/sentiment-view";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { SourceBadge } from "@/components/source-badge";
import { fmtAgo } from "@/lib/format";
import { getSentiment } from "@/lib/sentiment";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "Market Sentiment" };

export default async function SentimentPage() {
  let s;
  try {
    s = await getSentiment();
  } catch (e) {
    return <ErrorCard title="Could not read the market" message={e instanceof Error ? e.message : "Unknown error"} />;
  }
  return (
    <>
      <PageHeader title="Market Sentiment" description="One reading of how the crypto market feels right now, built from four live inputs you can inspect." />
      <SourceBadge className="-mt-4 mb-6" />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Right now" subtitle={`Updated ${fmtAgo(s.generatedAt)} · refreshed every 5 minutes`}>
          <SentimentView s={s} />
        </Panel>
        <Panel title="How it is calculated">
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Market breadth (35%).</strong> How many of the top 50 tokens, excluding stablecoins, are up over 24 hours and 7 days.</li>
            <li><strong className="text-foreground">News tone (25%).</strong> Bullish versus bearish headlines in the latest feed.</li>
            <li><strong className="text-foreground">Sector breadth (20%).</strong> How many crypto sectors are up over 24 hours.</li>
            <li><strong className="text-foreground">Order flow (20%).</strong> Whether buyers or sellers are taking liquidity on BTC and ETH.</li>
            <li>If an input is unavailable it is left out and the rest are rescaled, and the confidence drops. With fewer than two inputs there is no reading at all.</li>
            <li>Risk-on is +20 or higher, Risk-off is −20 or lower, anything between is Mixed. It describes the mood, not what will happen next. Not financial advice.</li>
          </ul>
        </Panel>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        See what the agents make of it: <Link href="/bots" className="text-accent underline">Live bots</Link> · <Link href="/markets" className="text-accent underline">Markets</Link>
      </p>
    </>
  );
}
