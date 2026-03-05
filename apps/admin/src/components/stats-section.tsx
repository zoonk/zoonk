import { Skeleton } from "@zoonk/ui/components/skeleton";
import { StatsSkeleton } from "./stats";

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
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-muted-foreground/70 text-sm">{subtitle}</p>}
      </header>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

const DEFAULT_SKELETON_ITEMS = 4;

export function StatsSectionSkeleton({ items = DEFAULT_SKELETON_ITEMS }: { items?: number }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </header>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: items }, (_, i) => (
          <StatsSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
