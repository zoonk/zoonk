import { cn } from "@zoonk/ui/lib/utils";

const CRITICAL_THRESHOLD = 25;
const AVERAGE_THRESHOLD = 50;
const GOOD_THRESHOLD = 60;

/**
 * Returns the Tailwind color class for a metric value based on threshold bands.
 * <25: critical (destructive + bold), 25-49: bad (destructive),
 * 50-59: average (warning), 60+: good (success).
 */
export function getMetricColor(value: number): string {
  if (value < CRITICAL_THRESHOLD) {
    return "text-destructive font-bold";
  }

  if (value < AVERAGE_THRESHOLD) {
    return "text-destructive";
  }

  if (value < GOOD_THRESHOLD) {
    return "text-warning";
  }

  return "text-success";
}

/**
 * A compact pill showing a metric label and its color-coded value inline
 * (e.g., "Morale 72").
 *
 * Reused across the story metrics bar, intro screen, and outcome screen
 * to ensure consistent metric presentation. The pill pulses on value
 * change via a CSS animation triggered by a key remount.
 */
export function StoryMetricPill({ metric, value }: { metric: string; value: number }) {
  return (
    <span
      key={value}
      className="animate-pulse-scale bg-muted/50 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 motion-reduce:animate-none"
    >
      <span className="text-muted-foreground text-xs">{metric}</span>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums transition-colors duration-500",
          getMetricColor(value),
        )}
      >
        {value}
      </span>
    </span>
  );
}
