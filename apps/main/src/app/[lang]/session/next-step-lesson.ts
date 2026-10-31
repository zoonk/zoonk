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

/** Only a lesson nothing writes can be refused, so a stale `?limit=` never hides a wait. */
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
