import { getMenu } from "@/lib/menu";
import { cn } from "@zoonk/ui/lib/utils";

/** Every stat has one color, the one its page's number and chart use. */
export type StatsMetric = "activity" | "energy" | "level" | "patterns" | "score";

export const METRIC_TONE: Readonly<Record<StatsMetric, string>> = {
  activity: "bg-info/15 text-info",
  energy: "bg-energy/15 text-energy",
  level: "bg-muted text-foreground",
  patterns: "bg-score/15 text-score",
  score: "bg-score/15 text-score",
};

/** A stat's icon on its tinted tile, beside its name. Decorative: the name says what it is. */
export function StatsMetricTile({
  className,
  metric,
}: {
  className?: string;
  metric: StatsMetric;
}) {
  const { icon: Icon } = getMenu(metric);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl [&>svg]:size-4.5",
        METRIC_TONE[metric],
        className,
      )}
    >
      <Icon />
    </span>
  );
}
