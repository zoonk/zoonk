import { cn } from "@zoonk/ui/lib/utils";
import { type LearnKind, kindFillClass } from "../_components/kind-tile";
import { MeterPart } from "../_components/meter";

const PERCENT = 100;

/** Where a block of the day stands: behind the learner (done or skipped), in progress, or ahead. */
export type DaySegmentState = "ahead" | "current" | "done" | "skipped";

/**
 * Blue once done, a neutral fill once skipped, a blue ring for the one in progress (where the
 * learner is, the edge of their progress; a solid segment read as done), and the track for the ones
 * ahead.
 */
const SEGMENT_STATE_CLASS: Record<DaySegmentState, string> = {
  ahead: "",
  current: "bg-transparent ring-success ring-[1.5px] ring-inset",
  done: "bg-success",
  skipped: "bg-foreground/25",
};

/**
 * The day's segments in one row, a meter of parts (`MeterParts`): 6px tall, 2px apart, as Today
 * draws them under its title. A public page adds `h-2`.
 */
export { METER_PARTS_CLASS as DAY_SEGMENTS_CLASS } from "../_components/meter";

/**
 * A block still ahead that isn't a lesson (a review, practice, a challenge, a mock) is tinted in
 * its kind's hue, at half strength so it never reads as done, and the day's shape shows at a
 * glance; its row says what it is. A lesson, most of every day, keeps the track.
 */
function getAheadClass(kind?: LearnKind): string {
  return kind && kind !== "lesson" ? cn(kindFillClass(kind), "opacity-50") : "";
}

/**
 * One block's segment, as long as its minutes, the one in progress filling blue as its questions
 * are answered (`share`, 0 to 1). Today draws the learner's day with it, and the public pages draw
 * an example day, so it's a module a server component can render.
 */
export function DaySegment({
  className,
  kind,
  minutes,
  share = 0,
  state,
}: {
  className?: string;
  /** What the block is, so a block ahead shows its kind (`getBlockKind`). */
  kind?: LearnKind;
  minutes: number;
  share?: number;
  state: DaySegmentState;
}) {
  return (
    <MeterPart
      as="span"
      className={cn(
        "relative overflow-hidden",
        SEGMENT_STATE_CLASS[state],
        state === "ahead" && getAheadClass(kind),
        className,
      )}
      weight={Math.max(1, minutes)}
    >
      {share > 0 && (
        <span
          className="bg-success absolute inset-y-0 left-0"
          style={{ width: `${share * PERCENT}%` }}
        />
      )}
    </MeterPart>
  );
}
