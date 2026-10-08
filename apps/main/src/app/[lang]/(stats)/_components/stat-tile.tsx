import { type AppRoute, Link } from "@/i18n/navigation";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { type StatsMetric } from "./stats-metric-tile";

/** Every stat's number has its stat's color, as on its page. */
const VALUE_TONE: Readonly<Record<StatsMetric, string>> = {
  activity: "text-info",
  energy: "text-energy",
  level: "text-foreground",
  patterns: "text-score",
  score: "text-score",
};

const TILE_CLASS = cn(SURFACE_CLASS, "flex min-w-0 flex-col gap-3 p-4");

/**
 * One number of a stat's page as a small card: what it counts and its number, in its stat's color.
 * With `href` it opens a page (a chevron says so); a number with nothing to count yet says so,
 * muted.
 */
export function StatTile<Href extends string>({
  emptyLabel,
  href,
  label,
  metric,
  value,
}: {
  /** Said instead of the number while there's nothing to count. */
  emptyLabel?: string;
  href?: AppRoute<Href>;
  label: string;
  metric: StatsMetric;
  value: string | null;
}) {
  // The number sits at the tile's foot, so tiles side by side keep their numbers on one line when
  // one label takes two lines.
  const content = (
    <span className="flex min-w-0 flex-1 flex-col justify-between gap-1">
      <span className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        {label}
        {href && (
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        )}
      </span>
      <span
        className={cn(
          "truncate tabular-nums first-letter:uppercase",
          value
            ? cn("text-2xl font-bold tracking-tight", VALUE_TONE[metric])
            : "text-muted-foreground text-lg font-semibold",
        )}
      >
        {value ?? emptyLabel}
      </span>
    </span>
  );

  if (!href) {
    return <div className={TILE_CLASS}>{content}</div>;
  }

  return (
    <Link
      className={cn(
        TILE_CLASS,
        "hover:bg-muted/40 focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-[3px]",
      )}
      href={href}
      prefetch
    >
      {content}
    </Link>
  );
}

/** Two stats side by side from the smallest phones up. */
export function StatTileGrid({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid grid-cols-2 gap-3", className)} {...props} />;
}
