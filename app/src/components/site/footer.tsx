import Link from "next/link";
import { BrandLogo } from "@/components/brand";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Markets", href: "/markets" },
      { label: "Intelligence Board", href: "/dashboard" },
      { label: "RSI Research", href: "/research" },
      { label: "News Impact", href: "/news" },
      { label: "Agents", href: "/agents" },
      { label: "Portfolio", href: "/portfolio" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Safety", href: "/#safety" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Wallet", href: "/wallet" },
      { label: "Billing", href: "/billing" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of service", href: "/terms" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Risk disclosure", href: "/risk" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_repeat(4,1fr)]">
        <div>
          <BrandLogo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">AI trading agents on Solana that show their work and trade only inside the limits you set.</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Built on Solana
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-sm font-medium">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div aria-hidden className="mx-auto max-w-6xl select-none overflow-hidden px-4 sm:px-6">
        <p className="-mb-[0.18em] text-center font-display text-[clamp(7rem,30vw,26rem)] font-semibold leading-[0.8] tracking-tighter text-foreground/[0.07]">
          Orca
        </p>
      </div>
    </footer>
  );
}
