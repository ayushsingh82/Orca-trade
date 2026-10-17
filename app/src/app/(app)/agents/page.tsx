import { PageHeader } from "@/components/page-header";

const TEMPLATES = ["Momentum", "Narrative Rotation", "Mean-Reversion", "Portfolio Rebalancer", "DCA+"];

export default function AgentsPage() {
  return (
    <>
      <PageHeader title="Agents" description="Create an agent from a template. Starts in observe mode." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button
            key={t}
            className="rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted"
          >
            <h2 className="font-display text-lg font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Template · observe mode</p>
          </button>
        ))}
      </div>
    </>
  );
}
