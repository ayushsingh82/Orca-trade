import Link from "next/link";
import { ErrorCard } from "@/components/error-card";
import { MarketsTable } from "@/components/markets/markets-table";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { getSolanaMarkets, getTopMarkets } from "@/lib/tokens/markets";
import { cn } from "@/lib/utils";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "Markets" };

const TABS = [
  { id: "top", label: "Top 50" },
  { id: "solana", label: "Solana ecosystem" },
] as const;

export default async function MarketsPage({ searchParams }: PageProps<"/markets">) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.id === rawTab) ? (rawTab as (typeof TABS)[number]["id"]) : "top";

  let rows;
  try {
    rows = tab === "top" ? await getTopMarkets(50) : await getSolanaMarkets();
  } catch (e) {
    return <ErrorCard title="Could not load markets" message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  return (
    <>
      <PageHeader title="Markets" description="The top 50 tokens and the main Solana ecosystem tokens, with price, change, market cap and volume." />
      <SourceBadge className="-mt-4 mb-5" />
      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link key={t.id} href={`/markets?tab=${t.id}`} className={cn("-mb-px border-b-2 px-4 py-2 text-sm", tab === t.id ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>
      <MarketsTable rows={rows} />
      <p className="mt-4 max-w-2xl text-xs text-muted-foreground">
        <strong>Agent-tradable</strong> tokens are a short reviewed list with enough on-chain liquidity. Everything else is view-only. Memecoins are marked high risk. Not financial advice.
      </p>
    </>
  );
}
