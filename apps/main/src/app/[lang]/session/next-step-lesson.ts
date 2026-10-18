import "server-only";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import {
  type LessonGenerationState,
  getLessonGenerationState,
} from "@zoonk/core/library/generation/state";
import { type NextStopFacts } from "@zoonk/core/sessions/page";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { type LessonNotWritten } from "@zoonk/learn/lesson-not-written";
import { type NextStopLesson } from "@zoonk/learn/session/next-stop";
import { type DayStep } from "@zoonk/learn/session/types";

/**
 * Where the next step's lesson stands: ready to start (written, no lesson at all, or never asked
 * for: Start asks for it, from the learner's tap, never from this read), being written, written
 * and failed, or asked for and not picked up by a run yet (`notStarted`). A request the address
 * carries for this step (`?generation=`, `?preparing`, or why it can't be written now: `?writing=`,
 * `?limit=`) counts as asked.
 */
export function getNextStopLesson({
  limit,
  request,
  state,
  step,
}: {
  limit: LessonLimit | null;
  request: LessonRequest;
  state: LessonGenerationState | null;
  step: DayStep;
}): NextStopLesson {
  if (step.kind !== "learn") {
    return "ready";
  }

  const status = state?.status;

  if (status === "ready") {
    return "ready";
  }

  if (status === "generating") {
    return "writing";
  }

  if (status === "failed") {
    return "failed";
  }

  return request.status === "idle" && !limit ? "ready" : "notStarted";
}

/**
 * The run writing the next step's lesson, so the wait follows its progress: the same readiness a
 * native client reads (`/v1/library/lessons/{lessonId}/readiness`), only while it's written, or
 * the run the learner's request just started, before the lesson says so itself.
 */
export function getWritingRunId({
  request,
  state,
}: {
  request: LessonRequest;
  state: LessonGenerationState | null;
}): string | null {
  if (state?.status === "generating") {
    return state.runId;
  }

  return state?.status !== "ready" && request.status === "writing" ? request.generationId : null;
}

/**
 * Why the next step's lesson won't be written now: every draft failed its checks (read from the
 * lesson), or the learner's request was just turned down (`?limit=`, from the tap that asked).
 * Only a lesson nothing writes can be refused, so a stale `?limit=` never hides a wait.
 */
export function getNotWritten({
  lesson,
  limit,
  request,
  state,
}: {
  lesson: NextStopLesson;
  limit: LessonLimit | null;
  request: LessonRequest;
  state: LessonGenerationState | null;
}): LessonNotWritten | null {
  if (
    (lesson === "notStarted" || lesson === "failed") &&
    (request.status === "plusRequired" || request.status === "setAside")
  ) {
    return request;
  }

  if (lesson === "failed" && state?.status === "failed") {
    return state.setAside ? { status: "setAside" } : null;
  }

  return lesson === "notStarted" && limit ? { limit, status: "refused" } : null;
}

/**
 * Where a step's lesson stands: the narrow read's facts for the day's next step, read here for
 * another step the learner opened (a lesson picked from Today's queue).
 */
export async function loadLessonState({
  next,
  step,
}: {
  next: NextStopFacts | null;
  step: DayStep;
}): Promise<LessonGenerationState | null> {
  if (next?.ref.position === step.position) {
    return next.lessonState;
  }

  return step.kind === "learn" && step.lessonId ? getLessonGenerationState(step.lessonId) : null;
}
