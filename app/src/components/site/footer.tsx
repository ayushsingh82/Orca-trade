import Link from "next/link";
import { BrandLogo } from "@/components/brand";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <BrandLogo />
          <p className="mt-2 max-w-sm text-xs text-muted-foreground">
            Not financial advice. Trading is risky and you can lose money. Start with paper trading and small amounts.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-muted-foreground md:items-end">
          <nav className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/risk" className="hover:text-foreground">Risk disclosure</Link>
          </nav>
          <p>© {new Date().getFullYear()} Orca</p>
        </div>
      </div>
    </footer>
  );
}
