"use client";

import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { TaskClose } from "../_components/task-close";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderSide,
  TaskHeaderTitle,
} from "../_components/task-header";
import { TASK_COLUMN_CLASS } from "../_components/task-layout";
import { DayMeter, type DayMeterPart } from "../today/day-segments";
import { WaitTopBarBack } from "../wait/wait-screen";
import { getDayMeterParts } from "./day-meter-parts";
import { type SessionQueueRow } from "./session-queue-rows";

const NO_BAR = { completed: 0, total: 0 } as const;

function getSessionMeterParts({
  queue,
  sessionBar,
}: {
  queue?: readonly SessionQueueRow[];
  sessionBar: { completed: number; total: number };
}): DayMeterPart[] {
  if (queue && queue.length > 0) {
    return getDayMeterParts({ rows: queue });
  }

  const { completed, total } = sessionBar;

  return Array.from({ length: total }, (_, index) => {
    if (index < completed) {
      return { id: index, state: "done" };
    }

    return { id: index, state: index === completed ? "current" : "ahead" };
  });
}

function useSessionProgressLabel({
  lessonsComing,
  sessionBar,
}: {
  lessonsComing: boolean;
  sessionBar: { completed: number; total: number };
}): string {
  const t = useExtracted();
  const values = { completed: sessionBar.completed, total: String(sessionBar.total) };

  return lessonsComing
    ? t(
        "{completed, plural, =0 {# of {total} done} one {# of {total} done} other {# of {total} done}} · more as you go",
        values,
      )
    : t(
        "{completed, plural, =0 {# of {total} done} one {# of {total} done} other {# of {total} done}}",
        values,
      );
}

export function SessionHeader({
  exitHref,
  lessonsComing = false,
  menu,
  queue,
  sessionBar = NO_BAR,
}: {
  exitHref: string;
  lessonsComing?: boolean;
  menu?: ReactNode;
  queue?: readonly SessionQueueRow[];
  sessionBar?: { completed: number; total: number };
}) {
  const t = useExtracted();
  const label = useSessionProgressLabel({ lessonsComing, sessionBar });
  const parts = getSessionMeterParts({ queue, sessionBar });

  return (
    <TaskHeader className="bg-background sticky top-0" data-slot="session-header">
      <TaskHeaderBar>
        <TaskHeaderSide align="start">
          <WaitTopBarBack>
            <TaskClose href={exitHref} prefetch={false} />
          </WaitTopBarBack>
        </TaskHeaderSide>

        <TaskHeaderTitle title={t("Today")} />

        <TaskHeaderSide align="end">{menu}</TaskHeaderSide>
      </TaskHeaderBar>

      <div className={TASK_COLUMN_CLASS}>
        <DayMeter held={lessonsComing} label={label} parts={parts} />
      </div>
    </TaskHeader>
  );
}
