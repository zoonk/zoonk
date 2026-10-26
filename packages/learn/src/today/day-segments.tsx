import { cn } from "@zoonk/ui/lib/utils";

const PERCENT = 100;

/** Where a block of the day stands: behind the learner (done or skipped), in progress, or ahead. */
export type DaySegmentState = "ahead" | "current" | "done" | "skipped";

/**
 * Blue once done, a neutral fill once skipped, an outline in the text color for the one in
 * progress (where they are; a solid segment read as done), and the track for the ones ahead.
 */
const SEGMENT_STATE_CLASS: Record<DaySegmentState, string> = {
  ahead: "bg-surface-3",
  current: "ring-selected ring-1 ring-inset",
  done: "bg-success",
  skipped: "bg-foreground/25",
};

/** The day's segments in one row, 4px tall, as Today draws them under its title. */
export const DAY_SEGMENTS_CLASS = "flex h-1 gap-[3px]";

/**
 * One block's segment, as long as its minutes, the one in progress filling blue as its questions
 * are answered (`share`, 0 to 1). Today draws the learner's day with it, and the public pages draw
 * an example day, so it's a module a server component can render.
 */
export function DaySegment({
  className,
  minutes,
  share = 0,
  state,
}: {
  className?: string;
  minutes: number;
  share?: number;
  state: DaySegmentState;
}) {
  return (
    <span
      className={cn(
        "relative overflow-hidden rounded-[2px]",
        SEGMENT_STATE_CLASS[state],
        className,
      )}
      style={{ flexGrow: Math.max(1, minutes) }}
    >
      {share > 0 && (
        <span
          className="bg-success absolute inset-y-0 left-0"
          style={{ width: `${share * PERCENT}%` }}
        />
      )}
    </span>
  );
}
