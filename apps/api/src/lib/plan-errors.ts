import { type GoalRefusal } from "@zoonk/core/goals/create";
import { type UnfundedMove } from "@zoonk/core/plans/plan-error-contract";
import { formatDuration } from "@zoonk/utils/duration";
import { type z } from "zod";
import { createErrorResponse, httpStatus, slowDownError } from "./api-errors";
import { signUpRequiredError } from "./lesson-player-errors";

/** Stable codes for the goal and plan endpoints. */
export const planErrorCodes = {
  goalLimitReached: "GOAL_LIMIT_REACHED",
  goalReferenceNotFound: "GOAL_REFERENCE_NOT_FOUND",
  planChangeConflict: "PLAN_CHANGE_CONFLICT",
  planChangeInvalid: "PLAN_CHANGE_INVALID",
  planLinkTitleRequired: "PLAN_LINK_TITLE_REQUIRED",
  targetDateOutOfRange: "TARGET_DATE_OUT_OF_RANGE",
} as const;

const OPERATION_MESSAGES = {
  badMove: "A weekly challenge can move to a later day within a week",
  mockCollision: "That day already has a weekly challenge or mock exam. Pick another day.",
  noStudyDays: "A plan needs at least one study day",
  notExam: "Only an exam's plan goes on after its date: other goals study everything without one",
  nothingLeft: "A plan can't skip every area",
  pastDate: "That date has already passed",
  unfundedMove: "Not enough study time before that day for this mock exam. Pick a later day.",
  unknownArea: "That area isn't in this plan",
  unknownOption: "That option isn't one of the exam's choices",
  unknownTool: "That tool isn't in this plan",
} as const;

/** A change the plan can't take, with the reason clients show. */
export function planChangeInvalid({
  error,
  unfundedMove,
}: {
  error: keyof typeof OPERATION_MESSAGES;
  unfundedMove?: UnfundedMove;
}) {
  const duration = unfundedMove
    ? formatDuration({ locale: "en", totalSeconds: unfundedMove.minutes * 60 })
    : null;

  const message =
    error === "unfundedMove" && unfundedMove
      ? `Not enough study time before ${unfundedMove.date} for this ${duration} mock exam. Pick a later day.`
      : OPERATION_MESSAGES[error];

  return createErrorResponse({
    code: planErrorCodes.planChangeInvalid,
    details: { reason: error, ...(unfundedMove && { unfundedMove }) },
    message,
    status: httpStatus.unprocessableEntity,
  });
}

/**
 * A new target date outside the supported range (see `InputRangeError`): each refused date with
 * its path and nearest accepted bound (`limit`). Existing plan-edit past-date answers remain
 * `PLAN_CHANGE_INVALID`, `pastDate`; a new goal checks both bounds here.
 */
export function targetDateOutOfRange(error: z.ZodError) {
  const [first] = error.issues;

  return createErrorResponse({
    code: planErrorCodes.targetDateOutOfRange,
    details: error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
      ...(issue.code === "custom" ? issue.params : {}),
    })),
    message: first?.message ?? "That date is outside the supported planning range",
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

/**
 * A goal the learner's plan doesn't allow: a limit to show, a moment to wait, or (a guest) a free
 * account to create.
 */
export function goalRefusedError(decision: GoalRefusal["decision"]) {
  if (decision.status === "signUpRequired") {
    return signUpRequiredError();
  }

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
