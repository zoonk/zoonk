import { DAY_SEGMENTS_CLASS, DaySegment, type DaySegmentState } from "@zoonk/learn/day-segments";
import { KindMark, type LearnKind } from "@zoonk/learn/kind-tile";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { DoneMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

/** One of an example day's steps: its kind, what it is, how long it takes and how far along it is. */
export type DayListStep = {
  detail?: string;
  /** A number on the row, pointing to its caption under the window (`AnnotationMark`). */
  annotation?: ReactNode;
  id: string;
  kind: LearnKind;
  minutes: number;
  state: "ahead" | "current" | "done";
  title: string;
};

const SEGMENT_STATE: Record<DayListStep["state"], DaySegmentState> = {
  ahead: "ahead",
  current: "current",
  done: "done",
};

/**
 * One of the day's steps as Today lists it: its kind's icon (the done mark and a quiet name once
 * done, never struck), its name over its detail, its minutes, the one under way highlighted.
 */
function DayRow({ minutesText, step }: { minutesText: string; step: DayListStep }) {
  const done = step.state === "done";

  return (
    <ListRow data-highlighted={step.state === "current" || undefined} role="listitem">
      <ListRowLeading className="w-3.5 justify-center">
        {done ? <DoneMark className="size-3.5" /> : <KindMark kind={step.kind} />}
      </ListRowLeading>

      <ListRowContent>
        {/* The row's number sits after its name, as a footnote's mark, away from the minutes. */}
        <span className="flex items-center gap-2">
          <ListRowTitle className={cn(done && "text-muted-foreground")}>{step.title}</ListRowTitle>
          {step.annotation}
        </span>
        {!done && step.detail && <ListRowDescription>{step.detail}</ListRowDescription>}
      </ListRowContent>

      <ListRowTrailing>{minutesText}</ListRowTrailing>
    </ListRow>
  );
}

/**
 * An example day as Today lists it, flat rows with a hairline between them, each step's minutes in
 * the app's compact durations (`minutesText`).
 */
export function DayList({
  className,
  minutesText,
  steps,
}: {
  className?: string;
  minutesText: (minutes: number) => string;
  steps: readonly DayListStep[];
}) {
  return (
    <ListGroup className={cn("isolate", className)} role="list">
      {steps.map((step) => (
        <DayRow key={step.id} minutesText={minutesText(step.minutes)} step={step} />
      ))}
    </ListGroup>
  );
}

/**
 * The example day at a glance, as under Today's title: a segment per step, as long as its
 * minutes, done ones blue, the one under way outlined, and one ahead that isn't a lesson tinted in
 * its kind's hue. Screen readers hear how far along it is.
 */
export async function DaySegments({
  className,
  steps,
}: {
  className?: string;
  steps: readonly DayListStep[];
}) {
  const t = await getExtracted();
  const done = steps.filter((step) => step.state === "done").length;

  return (
    <div
      aria-label={t(
        "{done, plural, =0 {# of {total, number} done} one {# of {total, number} done} other {# of {total, number} done}}",
        { done, total: steps.length },
      )}
      className={cn(DAY_SEGMENTS_CLASS, className)}
      role="img"
    >
      {steps.map((step) => (
        <DaySegment
          key={step.id}
          kind={step.kind}
          minutes={step.minutes}
          state={SEGMENT_STATE[step.state]}
        />
      ))}
    </div>
  );
}
