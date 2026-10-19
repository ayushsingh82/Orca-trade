import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That page does not exist, or it is not public.</p>
      <Link href="/dashboard" className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
        Open the board
      </Link>
    </div>
  );
}
