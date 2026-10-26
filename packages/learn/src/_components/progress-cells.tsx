import { cn } from "@zoonk/ui/lib/utils";
import { type LessonCounts, getLessonCells } from "./lesson-cells";

const PERCENT = 100;

/**
 * One cell of a goal's progress: the track, filled blue for what's studied and muted for what's
 * known (shares from 0 to 1, side by side as `CoverageBar` draws them), or outlined in blue when
 * it's progress still to come: today's lessons, the levels up to the target. Decoration: the card
 * around it says the same in words.
 */
export function ProgressCell({
  className,
  known = 0,
  planned = false,
  studied = 0,
}: {
  className?: string;
  known?: number;
  planned?: boolean;
  studied?: number;
}) {
  return (
    <span
      className={cn(
        "flex h-2 min-w-0 flex-1 overflow-hidden rounded-[2px]",
        planned ? "ring-success ring-1 ring-inset" : "bg-surface-3",
        className,
      )}
      data-slot="progress-cell"
    >
      {studied > 0 && (
        <span className="bg-success h-full" style={{ width: `${studied * PERCENT}%` }} />
      )}
      {known > 0 && (
        <span className="bg-muted-foreground/70 h-full" style={{ width: `${known * PERCENT}%` }} />
      )}
    </span>
  );
}

/**
 * A plan's lessons as a row of cells (`getLessonCells`), so "6 of 19" reads as six cells of
 * nineteen, today's outlined in blue.
 */
export function LessonCells({ className, ...counts }: LessonCounts & { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex gap-[3px]", className)} data-slot="lesson-cells">
      {getLessonCells(counts).map((cell, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- Cells are positions, not items.
        <ProgressCell {...cell} key={index} />
      ))}
    </span>
  );
}
