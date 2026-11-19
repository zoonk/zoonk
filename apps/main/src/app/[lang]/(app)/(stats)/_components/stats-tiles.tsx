import { LONE_STAT_CLASS } from "@zoonk/learn/stat-tile";
import { StatSkeleton } from "@zoonk/ui/components/stat";
import { cn } from "@zoonk/ui/lib/utils";

export const STAT_PAGE_TILES_CLASS =
  "gap-2 sm:grid-cols-3 sm:[&>li:last-child:nth-child(odd)]:col-span-1";

export function StatTilesSkeleton({
  className,
  count,
  detailed = 0,
  labeled = true,
}: {
  className?: string;
  count: number;
  /** How many of the first tiles have a line under their number. */
  detailed?: number;
  labeled?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid auto-rows-fr grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2",
        LONE_STAT_CLASS,
        count === 3 && "sm:grid-cols-3 sm:[&>*:last-child:nth-child(odd)]:col-span-1",
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- Static placeholders.
        <StatSkeleton detailLines={index < detailed ? 1 : 0} key={index} labeled={labeled} />
      ))}
    </div>
  );
}
