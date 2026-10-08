import { type GoalRefusal } from "@zoonk/core/goals/create";
import { createErrorResponse, httpStatus, slowDownError } from "./api-errors";

/** Stable codes for the goal and plan endpoints. */
export const planErrorCodes = {
  goalLimitReached: "GOAL_LIMIT_REACHED",
  goalReferenceNotFound: "GOAL_REFERENCE_NOT_FOUND",
  planChangeConflict: "PLAN_CHANGE_CONFLICT",
  planChangeInvalid: "PLAN_CHANGE_INVALID",
  planLinkTitleRequired: "PLAN_LINK_TITLE_REQUIRED",
} as const;

const OPERATION_MESSAGES = {
  badMove: "A weekly checkpoint can move to a later day within a week",
  noStudyDays: "A plan needs at least one study day",
  nothingLeft: "A plan can't skip every area",
  pastDate: "That date has already passed",
  unknownArea: "That area isn't in this plan",
  unknownTool: "That tool isn't in this plan",
} as const;

/** A change the plan can't take, with the reason clients show. */
export function planChangeInvalid(error: keyof typeof OPERATION_MESSAGES) {
  return createErrorResponse({
    code: planErrorCodes.planChangeInvalid,
    details: { reason: error },
    message: OPERATION_MESSAGES[error],
    status: httpStatus.unprocessableEntity,
  });
}

export function planChangeConflict() {
  return createErrorResponse({
    code: planErrorCodes.planChangeConflict,
    message: "This change was already answered, or the plan changed since",
    status: httpStatus.conflict,
  });
}

/** A goal the learner's plan doesn't allow: a limit to show, or a moment to wait. */
export function goalRefusedError(decision: GoalRefusal["decision"]) {
  if (decision.status === "slowDown") {
    return slowDownError({
      details: decision,
      message: "Too many new goals at once",
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }

  return createErrorResponse({
    code: planErrorCodes.goalLimitReached,
    details: decision.limit,
    message: "Your plan doesn't include another goal right now",
    status: httpStatus.tooManyRequests,
  });
}
