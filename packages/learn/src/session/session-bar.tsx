"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/**
 * Today's session as a row of short segments, one per block: done ones filled, the current one
 * marked. It sits under the lesson player's header and on the session screens, so a short lesson
 * always shows where it is in the day. Fun lights the segments with lime.
 */
export function SessionBar({
  className,
  completed,
  total,
}: {
  className?: string;
  completed: number;
  total: number;
}) {
  const t = useExtracted();
  const current = Math.min(completed, total - 1);

  return (
    <div
      aria-label={t("Today's session: {completed} of {total} done", {
        completed: String(completed),
        total: String(total),
      })}
      aria-valuemax={total}
      aria-valuemin={0}
      aria-valuenow={completed}
      className={cn("flex w-full items-center gap-1", className)}
      data-slot="session-bar"
      role="progressbar"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
            index < completed
              ? "bg-foreground in-data-[mode=fun]:bg-fun-lime"
              : "bg-muted in-data-[mode=fun]:bg-fun-track",
            index === current &&
              index >= completed &&
              "bg-foreground/35 in-data-[mode=fun]:bg-fun-lime/45",
          )}
          // oxlint-disable-next-line react/no-array-index-key -- Segments are positions in the day, not items.
          key={index}
        />
      ))}
    </div>
  );
}
