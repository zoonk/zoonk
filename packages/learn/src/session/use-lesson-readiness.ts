"use client";

import { useState } from "react";
import { usePoll } from "../_utils/use-poll";
import { type NextStopActions, type NextStopLesson } from "./next-stop";
import { type LessonReadiness } from "./session-types";

const READINESS_CHECK_MS = 5000;

type Shown = { generationId: string | null; lesson: NextStopLesson };

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

  // Until the run the learner asked for stops, nothing writing the lesson means it hasn't taken it yet.
  if (lesson === "notStarted") {
    return { generationId, lesson: runStopped ? "failed" : "notStarted" };
  }

  return { generationId: null, lesson: read.status === "failed" ? "failed" : "ready" };
}

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
