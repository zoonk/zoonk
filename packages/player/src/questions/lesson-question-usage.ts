import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/contract";
import { safeAsync } from "@zoonk/utils/error";
import { z } from "zod";
import { type LessonQuestionApiError } from "./lesson-question-api";

const HTTP_STATUS_PAYMENT_REQUIRED = 402;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

const slowDownSchema = z.object({
  code: z.literal(LESSON_PLAYER_ERROR_CODES.slowDown),
  details: z.object({ retryAfterSeconds: z.number().int().min(0) }),
});

const usageLimitSchema = z.object({
  period: z.enum(["day", "month", "total"]),
  tier: z.enum(["free", "guest", "plus"]),
});

const limitReachedSchema = z.object({
  code: z.literal(LESSON_PLAYER_ERROR_CODES.usageLimitReached),
  details: z.object({ limit: usageLimitSchema }),
});

const usageErrorSchema = z.object({
  error: z.discriminatedUnion("code", [slowDownSchema, limitReachedSchema]),
});

export type LessonQuestionUsageRefusal =
  | { kind: "slowDown"; retryAfterSeconds: number }
  | { kind: "usageLimit"; period: "day" | "month" | "total"; tier: "free" | "guest" | "plus" };

/**
 * Which allowance refused an API request, read from its error body: fair use asks the learner to
 * slow down, and a plan's cap asks guests to sign up and free learners to upgrade or wait. The
 * tutor's answers and the web player's "Simpler" and "Go deeper" read refusals this way.
 */
export function getUsageRefusal(body: unknown): LessonQuestionUsageRefusal | null {
  const parsed = usageErrorSchema.safeParse(body);

  if (!parsed.success) {
    return null;
  }

  const { error } = parsed.data;

  return error.code === LESSON_PLAYER_ERROR_CODES.slowDown
    ? { kind: "slowDown", retryAfterSeconds: error.details.retryAfterSeconds }
    : { kind: "usageLimit", ...error.details.limit };
}

/** Statuses whose body may say which allowance refused the request. */
const REFUSAL_STATUSES = new Set([
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_PAYMENT_REQUIRED,
  HTTP_STATUS_TOO_MANY_REQUESTS,
]);

export async function getRefusalError(response: Response): Promise<LessonQuestionApiError> {
  const { data: body } = await safeAsync<unknown>(() => response.json());
  const usage = getUsageRefusal(body);

  if (usage) {
    return usage;
  }

  return response.status === HTTP_STATUS_PAYMENT_REQUIRED
    ? { kind: "subscription" }
    : { kind: "unknown" };
}

export function isRefusal(response: Response): boolean {
  return REFUSAL_STATUSES.has(response.status);
}
