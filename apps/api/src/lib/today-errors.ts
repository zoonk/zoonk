import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type TodayViewResult } from "@zoonk/core/view-models/today/get";
import { createErrorResponse, httpStatus } from "./api-errors";
import { studySessionError } from "./study-session-errors";

export const todayErrorCodes = {
  /** A learner with no active goal has no Today yet: native apps open onboarding on this code. */
  noGoal: "NO_ACTIVE_GOAL",
  planChangeReadChanged: "TODAY_PLAN_CHANGE_CHANGED",
  planNotReady: "PLAN_NOT_READY",
  suggestedGoalAlreadyAnswered: "SUGGESTED_GOAL_ALREADY_ANSWERED",
} as const;

export function noGoalError(suggestedGoal: SuggestedGoalView | null) {
  return createErrorResponse({
    code: todayErrorCodes.noGoal,
    details: { suggestedGoal },
    message: "Start a goal to plan your days",
    status: httpStatus.notFound,
  });
}

export function planNotReadyError(goal: { id: string; kind: string; title: string }) {
  return createErrorResponse({
    code: todayErrorCodes.planNotReady,
    details: { goal },
    message: "Your plan is still being built",
    status: httpStatus.conflict,
  });
}

/** Every read of the day answers a day it can't show the way Today does. */
export function todayUnavailableError(result: Exclude<TodayViewResult, { status: "ready" }>) {
  if (result.status === "noGoal") {
    return noGoalError(result.suggestedGoal);
  }

  if (result.status === "preparing") {
    return planNotReadyError(result.goal);
  }

  return studySessionError(result);
}
