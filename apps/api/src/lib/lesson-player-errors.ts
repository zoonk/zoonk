import { type UsageDecision } from "@zoonk/core/entitlements/contract";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { createErrorResponse, errors, httpStatus, slowDownError } from "./api-errors";

type RefusedUsage = Exclude<UsageDecision, { status: "allowed" }>;

function getLimitStatus(tier: string): number {
  if (tier === "guest") {
    return httpStatus.forbidden;
  }

  return tier === "free" ? httpStatus.paymentRequired : httpStatus.tooManyRequests;
}

export function signUpRequiredError() {
  return createErrorResponse({
    code: LESSON_PLAYER_ERROR_CODES.signUpRequired,
    message: "Create your free account to continue",
    status: httpStatus.forbidden,
  });
}

export function usageDecisionError(decision: RefusedUsage) {
  if (decision.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (decision.status === "signUpRequired") {
    return signUpRequiredError();
  }

  if (decision.status === "slowDown") {
    return slowDownError({
      details: { retryAfterSeconds: decision.retryAfterSeconds },
      message: "Take a short break, then try again",
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }

  return createErrorResponse({
    code: LESSON_PLAYER_ERROR_CODES.usageLimitReached,
    details: { limit: decision.limit },
    message: "This plan's limit is reached",
    status: getLimitStatus(decision.limit.tier),
  });
}

export function plusRequiredError() {
  return createErrorResponse({
    code: LESSON_PLAYER_ERROR_CODES.plusRequired,
    message: "The rest of this exam plan comes with Plus",
    status: httpStatus.paymentRequired,
  });
}

export function lessonSetAsideError() {
  return createErrorResponse({
    code: LESSON_PLAYER_ERROR_CODES.lessonSetAside,
    message: "This lesson was set aside after its drafts failed their checks",
    status: httpStatus.conflict,
  });
}

export function runEndedError() {
  return createErrorResponse({
    code: LESSON_PLAYER_ERROR_CODES.runEnded,
    message: "This lesson run already finished",
    status: httpStatus.conflict,
  });
}
