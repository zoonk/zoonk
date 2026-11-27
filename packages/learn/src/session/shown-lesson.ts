import { type NextStopLesson } from "./next-stop";
import { type LessonReadiness } from "./session-types";

export type ShownLesson = { generationId: string | null; lesson: NextStopLesson };

export function getShownLesson({
  generationId,
  lesson,
  read,
  runStopped,
}: ShownLesson & { read: LessonReadiness | null; runStopped: boolean }): ShownLesson {
  if (!read) {
    return { generationId, lesson };
  }

  if (read.status === "ready") {
    return { generationId: null, lesson: "ready" };
  }

  if (read.status === "generating") {
    return { generationId: read.generationId ?? generationId, lesson: "writing" };
  }

  // The asked-for run holds the lesson from its start, so a failure read after it's named is that run's.
  // Before it takes the lesson, nothing writing it means it hasn't started yet.
  if (lesson === "notStarted") {
    const failed = runStopped || (generationId !== null && read.status === "failed");
    return { generationId, lesson: failed ? "failed" : "notStarted" };
  }

  return { generationId: null, lesson: read.status === "failed" ? "failed" : "ready" };
}
