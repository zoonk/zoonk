import "server-only";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { type LessonNotWritten } from "@zoonk/learn/lesson-not-written";
import { type NextStopLesson } from "@zoonk/learn/session/next-stop";
import { type DayStep } from "@zoonk/learn/session/types";

/**
 * The first frame, from the block's saved lesson state. A run the learner just started
 * (`?generation=`) is waited for even while the row still says the last try failed.
 */
export function getNextStopLesson({
  limit,
  request,
  step,
}: {
  limit: LessonLimit | null;
  request: LessonRequest;
  step: DayStep;
}): NextStopLesson {
  if (step.kind !== "learn") {
    return "ready";
  }

  const status = step.lesson?.status;

  if (status === "ready") {
    return "ready";
  }

  if (status === "generating") {
    return "writing";
  }

  if (request.status === "writing") {
    return "notStarted";
  }

  if (status === "failed" || request.status === "failed") {
    return "failed";
  }

  return request.status === "idle" && !limit ? "ready" : "notStarted";
}

/** Only the run the learner's tap started; a lesson's saved run may be long gone, so readiness names it. */
export function getAskedRunId({
  request,
  step,
}: {
  request: LessonRequest;
  step: DayStep;
}): string | null {
  return step.lesson?.status !== "ready" && request.status === "writing"
    ? request.generationId
    : null;
}

/** Only a lesson nothing writes can be refused, so a stale `?limit=` never hides a wait. */
export function getNotWritten({
  lesson,
  limit,
  request,
  step,
}: {
  lesson: NextStopLesson;
  limit: LessonLimit | null;
  request: LessonRequest;
  step: DayStep;
}): LessonNotWritten | null {
  if ((lesson === "notStarted" || lesson === "failed") && request.status === "setAside") {
    return request;
  }

  if (lesson === "failed" && step.lesson?.setAside) {
    return { status: "setAside" };
  }

  return lesson === "notStarted" && limit ? { limit, status: "refused" } : null;
}
