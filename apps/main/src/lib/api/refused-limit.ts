import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/contract";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { getNumber, getString, isJsonObject } from "@zoonk/utils/json";

const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const DEFAULT_RETRY_SECONDS = 60;
const REFUSED_STATUSES = new Set([HTTP_PAYMENT_REQUIRED, HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS]);

const TIERS = ["free", "guest", "plus"] as const;
const PERIODS = ["day", "month", "total"] as const;

function pick<Value extends string>(value: string | null, values: readonly Value[]) {
  return values.find((candidate) => candidate === value) ?? null;
}

/** A hard cap's tier: the envelope's `details.limit.tier`, else what the status says it is. */
function readTier({ limit, status }: { limit: unknown; status: number }) {
  const tier = pick(getString(limit, "tier"), TIERS);

  if (tier) {
    return tier;
  }

  if (status === HTTP_FORBIDDEN) {
    return "guest";
  }

  return status === HTTP_PAYMENT_REQUIRED ? "free" : "plus";
}

/**
 * The API's refusal of a metered request in the learner's terms (see the API's
 * `usageDecisionError`): 403 asks a guest to sign up, 402 a free learner to wait or get Plus, and
 * a 429 is a short break (`SLOW_DOWN`) or Plus's cap for today. `details.limit` says which cap it
 * was and when it starts over. Null for any other answer.
 */
export function readRefusedLimit({
  body,
  status,
}: {
  body: unknown;
  status: number;
}): LessonLimit | null {
  if (!REFUSED_STATUSES.has(status)) {
    return null;
  }

  const error = isJsonObject(body) ? body.error : null;
  const details = isJsonObject(error) ? error.details : null;
  const limit = isJsonObject(details) ? details.limit : null;

  if (getString(error, "code") === LESSON_PLAYER_ERROR_CODES.slowDown) {
    return {
      retryAfterSeconds: getNumber(details, "retryAfterSeconds") ?? DEFAULT_RETRY_SECONDS,
      status: "slowDown",
    };
  }

  return {
    period: pick(getString(limit, "period"), PERIODS) ?? "day",
    status: "limitReached",
    tier: readTier({ limit, status }),
  };
}
