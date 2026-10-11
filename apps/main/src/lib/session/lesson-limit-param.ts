import { type LessonLimit } from "@zoonk/learn/help-limit";

/**
 * The session screen's `?limit=`: why the next lesson wasn't written when the learner's tap asked
 * for it (the API answered in their browser, before the screen opened). Only the copy's inputs
 * travel: a guest, a free cap for the day or the month, Plus's day, a short break, or the guests'
 * daily AI budget (`sign-up`).
 */
export const LESSON_LIMIT_PARAM = "limit";

const SLOW_DOWN_PREFIX = "slow-down-";
const SIGN_UP_REQUIRED = "sign-up";

export function toLessonLimitParam(limit: LessonLimit): string {
  if (limit.status === "slowDown") {
    return `${SLOW_DOWN_PREFIX}${Math.max(0, Math.round(limit.retryAfterSeconds))}`;
  }

  if (limit.status === "signUpRequired") {
    return SIGN_UP_REQUIRED;
  }

  if (limit.tier === "free") {
    return limit.period === "month" ? "free-month" : "free-day";
  }

  return limit.tier;
}

const SLOW_DOWN_PATTERN = /^slow-down-(?<seconds>\d+)$/u;

function readSlowDown(value: string): LessonLimit | null {
  const seconds = SLOW_DOWN_PATTERN.exec(value)?.groups?.seconds;
  return seconds ? { retryAfterSeconds: Number(seconds), status: "slowDown" } : null;
}

/** Reads `?limit=` back; anything it doesn't know is no limit. */
export function readLessonLimitParam(value: unknown): LessonLimit | null {
  if (typeof value !== "string") {
    return null;
  }

  switch (value) {
    case "guest":
      return { period: "total", status: "limitReached", tier: "guest" };
    case "free-day":
      return { period: "day", status: "limitReached", tier: "free" };
    case "free-month":
      return { period: "month", status: "limitReached", tier: "free" };
    case "plus":
      return { period: "day", status: "limitReached", tier: "plus" };
    case SIGN_UP_REQUIRED:
      return { status: "signUpRequired" };
    default:
      return readSlowDown(value);
  }
}
