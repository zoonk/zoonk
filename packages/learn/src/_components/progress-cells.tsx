import { cn } from "@zoonk/ui/lib/utils";
import { type LessonCounts, getLessonCells } from "./lesson-cells";

const PERCENT = 100;

/** Shares are 0 to 1. */
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
