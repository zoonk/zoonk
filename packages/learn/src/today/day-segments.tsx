import { cn } from "@zoonk/ui/lib/utils";
import { type LearnKind, kindFillClass } from "../_components/kind-tile";
import { MeterPart } from "../_components/meter";

const PERCENT = 100;

export type DaySegmentState = "ahead" | "current" | "done" | "skipped";

const SEGMENT_STATE_CLASS: Record<DaySegmentState, string> = {
  ahead: "",
  current: "bg-transparent ring-success ring-[1.5px] ring-inset",
  done: "bg-success",
  skipped: "bg-foreground/25",
};

function getAheadClass(kind?: LearnKind): string {
  return kind && kind !== "lesson" ? cn(kindFillClass(kind), "opacity-50") : "";
}

/** `share` is 0 to 1. Server components draw it too (the public pages' example day). */
export function DaySegment({
  className,
  kind,
  minutes,
  share = 0,
  state,
}: {
  className?: string;
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
