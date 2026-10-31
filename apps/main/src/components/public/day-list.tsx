import { DaySegment, type DaySegmentState } from "@zoonk/learn/day-segments";
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
import { METER_PARTS_CLASS } from "@zoonk/learn/meter";
import { DoneMark } from "@zoonk/learn/status-mark";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

export type DayListStep = {
  detail?: string;
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

function DayRow({ minutesText, step }: { minutesText: string; step: DayListStep }) {
  const done = step.state === "done";

  return (
    <ListRow data-highlighted={step.state === "current" || undefined} role="listitem">
      <ListRowLeading className="w-3.5 justify-center">
        {done ? <DoneMark className="size-3.5" /> : <KindMark kind={step.kind} />}
      </ListRowLeading>

      <ListRowContent>
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
      className={cn(METER_PARTS_CLASS, className)}
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
