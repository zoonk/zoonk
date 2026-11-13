import { type LessonLimit } from "@zoonk/learn/help-limit";

/** Only the copy's inputs travel in the address. */
export const LESSON_LIMIT_PARAM = "limit";

const SLOW_DOWN_PREFIX = "slow-down-";
const FREE_LESSONS_USED_PREFIX = "free-opens-";
const SIGN_UP_REQUIRED = "sign-up";

export function toLessonLimitParam(limit: LessonLimit): string {
  if (limit.status === "slowDown") {
    return `${SLOW_DOWN_PREFIX}${Math.max(0, Math.round(limit.retryAfterSeconds))}`;
  }

  if (limit.status === "signUpRequired") {
    return SIGN_UP_REQUIRED;
  }

  if (limit.period === "rolling30Days") {
    return `${FREE_LESSONS_USED_PREFIX}${Date.parse(limit.availableAt) || 0}`;
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

const FREE_LESSONS_USED_PATTERN = /^free-opens-(?<opens>\d+)$/u;

function readFreeLessonsUsed(value: string): LessonLimit | null {
  const opens = FREE_LESSONS_USED_PATTERN.exec(value)?.groups?.opens;
  const date = new Date(Number(opens ?? Number.NaN));

  // A number in the address past what a Date holds is no date, the same as no number.
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    availableAt: date.toISOString(),
    period: "rolling30Days",
    status: "limitReached",
    tier: "free",
  };
}

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
      return readSlowDown(value) ?? readFreeLessonsUsed(value);
  }
}
