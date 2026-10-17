import { PageHeader } from "@/components/page-header";

export default function PortfolioPage() {
  return (
    <>
      <PageHeader title="Portfolio" description="Positions, PnL and per-agent attribution." />
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        No positions yet. Connect a wallet or run a paper agent to get started.
      </div>
    </>
  );
}
