/**
 * A stats page inside the learning tabs: its title and what it shows, then the content, in the
 * tabs' own column. The learn shell already pads that column, so the page adds no gutter of its
 * own and lines up with Progress and the pills above it.
 */
export function StatsPage({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-6" data-slot="stats-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-muted-foreground text-sm text-pretty">{description}</p>
      </header>
      {children}
    </div>
  );
}
