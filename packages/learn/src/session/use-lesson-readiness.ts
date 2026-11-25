"use client";

import { useState } from "react";
import { usePoll } from "../_utils/use-poll";
import { type NextStopActions, type NextStopLesson } from "./next-stop";
import { type LessonReadiness } from "./session-types";

const READINESS_CHECK_MS = 5000;

type Shown = { generationId: string | null; lesson: NextStopLesson };

/**
 * `notStarted` is the wait for a run the learner just asked for. Until that run stops, a read that
 * finds nothing writing only means the run hasn't taken the lesson yet.
 */
function toShown({
  generationId,
  lesson,
  read,
  runStopped,
}: Shown & { read: LessonReadiness | null; runStopped: boolean }): Shown {
  if (!read) {
    return { generationId, lesson };
  }

  if (read.status === "ready") {
    return { generationId: null, lesson: "ready" };
  }

  if (read.status === "generating") {
    return { generationId: read.generationId ?? generationId, lesson: "writing" };
  }

  if (lesson === "notStarted") {
    return { generationId, lesson: runStopped ? "failed" : "notStarted" };
  }

  return { generationId: null, lesson: read.status === "failed" ? "failed" : "ready" };
}

/**
 * The session's snapshot draws the first frame; the API's readiness, asked on mount and on each
 * tick while the lesson isn't ready, is what the screen shows from then on. A changed answer shows
 * at once, then the day is read again.
 */
export function useLessonReadiness({
  actions,
  enabled,
  generationId,
  lesson,
  lessonId,
}: Shown & {
  actions: Pick<NextStopActions, "readLesson" | "refresh">;
  enabled: boolean;
  lessonId: string | null;
}) {
  const key = `${lessonId ?? ""}:${lesson}:${generationId ?? ""}`;
  const [answer, setAnswer] = useState<{ key: string; read: LessonReadiness } | null>(null);
  const [stopped, setStopped] = useState<{ key: string; runId: string | null } | null>(null);
  const read = answer?.key === key ? answer.read : null;
  const runStopped = stopped?.key === key && stopped.runId === generationId;
  const shown = toShown({ generationId, lesson, read, runStopped });
  const readLesson = actions.readLesson;

  const poll = usePoll({
    active: enabled && lessonId !== null && readLesson !== undefined && shown.lesson !== "ready",
    intervalMs: READINESS_CHECK_MS,
    key,
    onPoll: async (signal) => {
      if (!lessonId || !readLesson) {
        return;
      }

      const next = await readLesson(lessonId);

      if (signal.aborted || !next) {
        return;
      }

      const after = toShown({ generationId, lesson, read: next, runStopped });
      setAnswer({ key, read: next });

      // A new run to follow changes nothing the day shows.
      if (next.setAside || after.lesson !== shown.lesson) {
        actions.refresh();
      }
    },
  });

  return {
    ...shown,
    check: poll.restart,
    /** The run this wait followed stopped: the next read decides what that means for the lesson. */
    runStopped: () => {
      setStopped({ key, runId: generationId });
      poll.restart();
    },
    setAside: read?.setAside ?? false,
    /** The API says the lesson is written, whatever the screen showed before. */
    written: read?.status === "ready",
  };
}
