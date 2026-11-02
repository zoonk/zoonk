import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { createErrorResponse, httpStatus } from "./api-errors";

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
