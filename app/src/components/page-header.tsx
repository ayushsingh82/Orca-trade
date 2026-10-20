export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-8 border-b pb-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
    </header>
  );
}
