import Link from "next/link";
import { cn } from "@/lib/utils";

/** The Orca mark: an orca in side profile on the accent tile. Colours follow the theme tokens. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Orca" className={cn("size-7", className)}>
      <rect width="64" height="64" rx="16" className="fill-accent" />
      <g transform="translate(-1.5 4.5)">
        <path
          className="fill-accent-foreground"
          d="M6 37C6.5 30.5 13.5 26.5 22 26.5C26 26.5 27.5 23 30.5 12C32.5 19.5 34 25 38.5 27C44.5 29.5 49.5 27.5 53 22.5C54.2 20.8 56.2 19.4 59 18.8C57.6 21.6 57.4 24.6 56.4 27.4C58.4 28.4 59.8 29.6 61 31.6C58.2 31.4 56.2 31.8 54.2 33C49 37 41 40.8 31 42C20 43.2 9.5 42 6 37Z"
        />
        <path className="fill-accent" d="M15 39.2C21 41 29.5 40.6 36.5 38C30.5 36.4 21.5 36.4 15 39.2Z" />
        <ellipse className="fill-accent" cx="15.5" cy="31.4" rx="3" ry="1.5" transform="rotate(-18 15.5 31.4)" />
      </g>
    </svg>
  );
}

export function BrandLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <BrandMark />
      <span className="font-display text-lg font-semibold tracking-tight">Orca</span>
    </Link>
  );
}
