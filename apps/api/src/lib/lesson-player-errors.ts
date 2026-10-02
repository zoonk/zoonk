import { type UsageDecision } from "@zoonk/core/entitlements/contract";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/contract";
import { createErrorResponse, errors, httpStatus, slowDownError } from "./api-errors";

type RefusedUsage = Exclude<UsageDecision, { status: "allowed" }>;

/**
 * A hard cap asks guests to sign up (403), free learners to upgrade (402) and Plus learners to
 * come back after it resets (429). `details.limit` says which cap it was.
 */
function getLimitStatus(tier: string): number {
  if (tier === "guest") {
    return httpStatus.forbidden;
  }

  return tier === "free" ? httpStatus.paymentRequired : httpStatus.tooManyRequests;
}

/** Maps a refused allowance claim to the shared error envelope. */
export function usageDecisionError(decision: RefusedUsage) {
  if (decision.status === "unauthorized") {
    return errors.unauthorized();
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

/** Every draft the lesson gets was held back by its checks: nothing writes it again. */
export function lessonSetAsideError() {
  return createErrorResponse({
    code: LESSON_PLAYER_ERROR_CODES.lessonSetAside,
    message: "This lesson was set aside after its drafts failed their checks",
    status: httpStatus.conflict,
  });
}

/** A run that already finished takes no more answers; the player starts a new one. */
export function runEndedError() {
  return createErrorResponse({
    code: LESSON_PLAYER_ERROR_CODES.runEnded,
    message: "This lesson run already finished",
    status: httpStatus.conflict,
  });
}

/** A client answering the same screen over and over in one run. */
export function tooManyAnswersError() {
  return createErrorResponse({
    code: LESSON_PLAYER_ERROR_CODES.tooManyAnswers,
    message: "This screen was already answered in this run",
    status: httpStatus.tooManyRequests,
  });
}
