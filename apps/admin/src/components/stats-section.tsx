import { Skeleton } from "@zoonk/ui/components/skeleton";
import { StatsSkeleton } from "./stats";

const GRID_CLASS = "grid grid-cols-2 gap-2 lg:grid-cols-4";

export function StatsSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-[0.8125rem]">{subtitle}</p>}
      </header>

      <div className={GRID_CLASS}>{children}</div>
    </section>
  );
}

const DEFAULT_SKELETON_ITEMS = 4;

export function StatsSectionSkeleton({ items = DEFAULT_SKELETON_ITEMS }: { items?: number }) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </header>

      <div className={GRID_CLASS}>
        {Array.from({ length: items }, (_, i) => (
          <StatsSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
