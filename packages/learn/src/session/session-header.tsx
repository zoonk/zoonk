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

/**
 * The day's blocks as segments: done ones green, the next one in view, the rest ahead. With the
 * day's queue each block's segment is as long as its minutes, as Today draws the day; with only
 * the counts, the first ones done and every segment the same length.
 */
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

/**
 * How far the day is, for screen readers: "2 of 6 done", and, while it holds time for lessons still
 * being outlined, that more come as the learner goes, as Today says, so the count growing when
 * they land is no surprise.
 */
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

/**
 * The header between the session's blocks (the next stop, a block just done, a lesson's end), the
 * same as every task's: leave on the left (Escape too: nothing is open, so nothing is lost),
 * "Today's session" in the middle, and the day as one segment per block under it, done ones green,
 * each as long as its minutes when the day's `queue` is known. It's the one place the whole
 * session shows on a phone.
 */
export function SessionHeader({
  exitHref,
  lessonsComing = false,
  menu,
  queue,
  sessionBar = NO_BAR,
}: {
  exitHref: string;
  /** The day holds time for lessons still being outlined, which join its end once they land. */
  lessonsComing?: boolean;
  /** A "…" menu on its end side, such as a finished lesson's, with its summary card. */
  menu?: ReactNode;
  /** The day's blocks in order (`getSessionQueue`), for segments as long as their minutes. */
  queue?: readonly SessionQueueRow[];
  /** The day's counts; without them (and without `queue`), the header has no bar. */
  sessionBar?: { completed: number; total: number };
}) {
  const t = useExtracted();
  const label = useSessionProgressLabel({ lessonsComing, sessionBar });
  const closeRef = useEscapeClick<HTMLAnchorElement>();
  const { segments, weights } = getSessionSegments({ queue, sessionBar });

  return (
    <TaskHeader className="bg-background sticky top-0 z-20" data-slot="session-header">
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
