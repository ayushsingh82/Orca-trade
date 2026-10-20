import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { watchlist } from "@/db/schema";
import { ErrorCard } from "@/components/error-card";
import { MarketsTable } from "@/components/markets/markets-table";
import { TokenSearch } from "@/components/markets/token-search";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { getUser } from "@/lib/auth/session";
import { getMarketsByIds, getSolanaMarkets, getTopMarkets } from "@/lib/tokens/markets";
import { cn } from "@/lib/utils";
import { BetaLink } from "@/components/beta-link";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "Markets" };

const TABS = [
  { id: "top", label: "Top 50" },
  { id: "solana", label: "Solana ecosystem" },
  { id: "watchlist", label: "Following" },
] as const;

export default async function MarketsPage({ searchParams }: PageProps<"/markets">) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.id === rawTab) ? (rawTab as (typeof TABS)[number]["id"]) : "top";
  const user = await getUser();
  const followed = user ? await db().select().from(watchlist).where(eq(watchlist.userId, user.id)).orderBy(desc(watchlist.createdAt)) : [];

  let rows;
  try {
    rows = tab === "top" ? await getTopMarkets(50) : tab === "solana" ? await getSolanaMarkets() : followed.length ? await getMarketsByIds(followed.map((f) => f.coinId)) : [];
  } catch (e) {
    return <ErrorCard title="Could not load markets" message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  return (
    <>
      <PageHeader title="Markets" description="The top 50 tokens and the main Solana ecosystem tokens, with search across every listed coin. Follow tokens to keep them in one list." />
      <SourceBadge className="-mt-4 mb-5" />
      <TokenSearch />
      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link key={t.id} href={`/markets?tab=${t.id}`} className={cn("-mb-px border-b-2 px-4 py-2 text-sm", tab === t.id ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.id === "watchlist" && followed.length > 0 && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{followed.length}</span>}
          </Link>
        ))}
      </div>
      {tab === "watchlist" && !user ? (
        <p className="text-sm text-muted-foreground">
          <BetaLink className="text-accent underline">Sign in</BetaLink> to follow tokens.
        </p>
      ) : tab === "watchlist" && followed.length === 0 ? (
        <p className="text-sm text-muted-foreground">You are not following any tokens yet. Press the star next to a token, or search for one above.</p>
      ) : (
        <MarketsTable rows={rows} watched={followed.map((f) => f.coinId)} loggedIn={Boolean(user)} />
      )}
      <p className="mt-4 max-w-2xl text-xs text-muted-foreground">
        <strong>Agent-tradable</strong> tokens are a short reviewed list with enough on-chain liquidity. Everything else is view-only. Memecoins are marked high risk. Not financial advice.
      </p>
    </>
  );
}
