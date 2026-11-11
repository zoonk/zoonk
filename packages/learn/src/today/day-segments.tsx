import { cn } from "@zoonk/ui/lib/utils";
import { type LearnKind, kindFillClass } from "../_components/kind-tile";
import { METER_PARTS_CLASS, MeterPart } from "../_components/meter";

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

/**
 * `share` is 0 to 1; `filling` draws a done part filling up from empty. Server components draw it
 * too (the public pages' example day and plan phases).
 */
export function DaySegment({
  className,
  filling = false,
  kind,
  share = 0,
  state,
  weight = 1,
}: {
  className?: string;
  filling?: boolean;
  kind?: LearnKind;
  share?: number;
  state: DaySegmentState;
  weight?: number;
}) {
  return (
    <MeterPart
      as="span"
      className={cn(
        "relative overflow-hidden",
        !filling && SEGMENT_STATE_CLASS[state],
        state === "ahead" && getAheadClass(kind),
        className,
      )}
      data-filling={filling || undefined}
      weight={Math.max(1, weight)}
    >
      {filling && <span className="bg-success animate-fill absolute inset-0 origin-left" />}
      {share > 0 && (
        <span
          className="bg-success absolute inset-y-0 left-0"
          style={{ width: `${share * PERCENT}%` }}
        />
      )}
    </MeterPart>
  );
}

export type DayMeterPart = {
  id: number | string;
  kind?: LearnKind;
  share?: number;
  state: DaySegmentState;
};

/**
 * The day's blocks as equal parts, so the meter, the count and the percent say one thing. `held`
 * adds one part for time the day keeps for lessons not on the list yet, so the meter never looks
 * full while more is coming. Without a `label` it hides from assistive tech, for a screen whose
 * words already say it.
 */
export function DayMeter({
  className,
  fillingId,
  held = false,
  label,
  parts,
}: {
  className?: string;
  fillingId?: number | string | null;
  held?: boolean;
  label?: string;
  parts: readonly DayMeterPart[];
}) {
  return (
    <div
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(METER_PARTS_CLASS, className)}
      data-slot="day-meter"
      role={label ? "img" : undefined}
    >
      {parts.map((part) => (
        <DaySegment
          filling={part.id === fillingId}
          key={part.id}
          kind={part.kind}
          share={part.share}
          state={part.state}
        />
      ))}
      {held && <DaySegment kind="lesson" state="ahead" />}
    </div>
  );
}
