import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

export const STAT_PAGE_TILES_CLASS =
  "gap-2 sm:grid-cols-3 sm:[&>li:last-child:nth-child(odd)]:col-span-1";

export function StatTilesSkeleton({ className, count }: { className?: string; count: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2",
        count === 3 && "sm:grid-cols-3 sm:[&>*:last-child:nth-child(odd)]:col-span-1",
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- Static placeholders.
        <Skeleton className="h-24.5 rounded-xl" key={index} />
      ))}
    </div>
  );
}

export function StatsLine({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground max-w-column text-sm text-pretty">{children}</p>;
}
