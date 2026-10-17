"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LayoutDashboard, Wallet } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Opportunities", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r bg-background p-4 md:flex">
      <BrandLogo />
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-muted text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto rounded-lg border bg-card p-3 text-xs text-muted-foreground">
        Mock data · observe mode. No funds at risk.
      </p>
    </aside>
  );
}
