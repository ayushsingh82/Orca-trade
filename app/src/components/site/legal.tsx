import type { ReactNode } from "react";
import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";

/** Shared shell for the legal pages. The wording is a starting template, not legal advice. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <p className="mt-6 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          This page is a plain-language template. Have a lawyer review it for your jurisdiction before you charge customers or enable live trading.
        </p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
