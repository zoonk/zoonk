"use client";

import { useState } from "react";
import { usePoll } from "../_utils/use-poll";
import { type NextStopActions } from "./next-stop";
import { type LessonReadiness } from "./session-types";
import { type ShownLesson, getShownLesson } from "./shown-lesson";

const READINESS_CHECK_MS = 5000;

export function useLessonReadiness({
  actions,
  enabled,
  generationId,
  lesson,
  lessonId,
}: ShownLesson & {
  actions: Pick<NextStopActions, "readLesson" | "refresh">;
  enabled: boolean;
  lessonId: string | null;
}) {
  const key = `${lessonId ?? ""}:${lesson}:${generationId ?? ""}`;
  const [answer, setAnswer] = useState<{ key: string; read: LessonReadiness } | null>(null);
  const [stopped, setStopped] = useState<{ key: string; runId: string | null } | null>(null);
  const read = answer?.key === key ? answer.read : null;
  const runStopped = stopped?.key === key && stopped.runId === generationId;
  const shown = getShownLesson({ generationId, lesson, read, runStopped });
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

      const after = getShownLesson({ generationId, lesson, read: next, runStopped });
      setAnswer({ key, read: next });

      // A new run to follow changes nothing the day shows, and a written lesson moves on through the
      // caller's ready hold, so a learner using the wait isn't pulled out of it.
      if (next.setAside || (after.lesson !== shown.lesson && after.lesson !== "ready")) {
        actions.refresh();
      }
    },
    timeoutMs: Number.POSITIVE_INFINITY,
  });

  return {
    ...shown,
    check: poll.restart,
    runStopped: () => {
      setStopped({ key, runId: generationId });
      poll.restart();
    },
    setAside: read?.setAside ?? false,
    written: read?.status === "ready",
  };
}
