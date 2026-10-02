import { type LessonLimit } from "@zoonk/learn/help-limit";

/**
 * The session screen's `?limit=`: why the next lesson wasn't written when the learner's tap asked
 * for it (the API answered in their browser, before the screen opened). Only the copy's inputs
 * travel: a guest, a free cap for the day or the month, Plus's day, or a short break.
 */
export const LESSON_LIMIT_PARAM = "limit";

const SLOW_DOWN_PREFIX = "slow-down-";

export function toLessonLimitParam(limit: LessonLimit): string {
  if (limit.status === "slowDown") {
    return `${SLOW_DOWN_PREFIX}${Math.max(0, Math.round(limit.retryAfterSeconds))}`;
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
    default:
      return readSlowDown(value);
  }
}
