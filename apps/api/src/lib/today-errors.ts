import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { createErrorResponse, httpStatus } from "./api-errors";

/** Stable codes for Today and the goals it suggests. */
export const todayErrorCodes = {
  /** A learner with no active goal has no Today yet: native apps open onboarding on this code. */
  noGoal: "NO_ACTIVE_GOAL",
  planNotReady: "PLAN_NOT_READY",
  suggestedGoalAlreadyAnswered: "SUGGESTED_GOAL_ALREADY_ANSWERED",
} as const;

/** Carries the suggested goal, if any, so apps can offer it before opening onboarding. */
export function noGoalError(suggestedGoal: SuggestedGoalView | null) {
  return createErrorResponse({
    code: todayErrorCodes.noGoal,
    details: { suggestedGoal },
    message: "Start a goal to plan your days",
    status: httpStatus.notFound,
  });
}

/** The goal's plan is still being built after onboarding: clients show the wait and ask again. */
export function planNotReadyError(goal: { id: string; kind: string; title: string }) {
  return createErrorResponse({
    code: todayErrorCodes.planNotReady,
    details: { goal },
    message: "Your plan is still being built",
    status: httpStatus.conflict,
  });
}
