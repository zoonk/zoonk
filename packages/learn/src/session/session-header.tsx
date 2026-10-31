"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import {
  TASK_HEADER_ICON_CLASS,
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderSegments,
  TaskHeaderSide,
  TaskHeaderTitle,
  type TaskSegment,
} from "../_components/task-header";
import { LearnLink } from "../learn-link";
import { type SessionQueueRow } from "./session-queue-rows";

const PERCENT = 100;

const NO_BAR = { completed: 0, total: 0 } as const;

const SEGMENT_BY_STATE: Record<SessionQueueRow["state"], TaskSegment> = {
  ahead: "ahead",
  done: "done",
  next: "current",
};

function getSessionSegments({
  queue,
  sessionBar,
}: {
  queue?: readonly SessionQueueRow[];
  sessionBar: { completed: number; total: number };
}): { segments: TaskSegment[]; weights?: number[] } {
  if (queue && queue.length > 0) {
    return {
      segments: queue.map((row) => SEGMENT_BY_STATE[row.state]),
      weights: queue.map((row) => row.block.estimatedMinutes),
    };
  }

  const { completed, total } = sessionBar;

  return {
    segments: Array.from({ length: total }, (_, index): TaskSegment => {
      if (index < completed) {
        return "done";
      }

      return index === completed ? "current" : "ahead";
    }),
  };
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
  const closeRef = useEscapeClick<HTMLAnchorElement>();
  const { segments, weights } = getSessionSegments({ queue, sessionBar });

  return (
    <TaskHeader className="bg-background sticky top-0" data-slot="session-header">
      <TaskHeaderBar>
        <TaskHeaderSide align="start">
          <LearnLink
            aria-keyshortcuts="Escape"
            aria-label={t("Back to Today")}
            className={cn(
              buttonVariants({ size: "icon", variant: "ghost" }),
              TASK_HEADER_ICON_CLASS.start,
            )}
            href={exitHref}
            prefetch={false}
            ref={closeRef}
          >
            <XIcon aria-hidden="true" />
          </LearnLink>
        </TaskHeaderSide>

        <TaskHeaderTitle title={t("Today's session")} />

        <TaskHeaderSide align="end">{menu}</TaskHeaderSide>
      </TaskHeaderBar>

      {segments.length > 0 && (
        <TaskHeaderSegments
          label={label}
          segments={segments}
          value={sessionBar.total === 0 ? 0 : (sessionBar.completed / sessionBar.total) * PERCENT}
          weights={weights}
        />
      )}
    </TaskHeader>
  );
}
