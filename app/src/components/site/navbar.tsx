import Link from "next/link";
import { BrandLogo } from "@/components/brand";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#safety", label: "Safety" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <BrandLogo />
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Login
          </Link>
          <Link href="/dashboard" className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90">
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}
