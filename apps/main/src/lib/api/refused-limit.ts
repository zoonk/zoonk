import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { type CalendarLimit, type FreeLessonsUsed } from "@zoonk/learn/help-limit";
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

function readLimitDetails(body: unknown) {
  const error = isJsonObject(body) ? body.error : null;
  const details = isJsonObject(error) ? error.details : null;
  return { details, error, limit: isJsonObject(details) ? details.limit : null };
}

export function readRefusedLimit({
  body,
  status,
}: {
  body: unknown;
  status: number;
}): CalendarLimit | null {
  if (!REFUSED_STATUSES.has(status)) {
    return null;
  }

  const { details, error, limit } = readLimitDetails(body);

  if (getString(error, "code") === LESSON_PLAYER_ERROR_CODES.signUpRequired) {
    return { status: "signUpRequired" };
  }

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

/** Only a new lesson is counted over the free plan's last 30 days, so only its refusal carries the instant. */
export function readRefusedLessonLimit({
  body,
  status,
}: {
  body: unknown;
  status: number;
}): CalendarLimit | FreeLessonsUsed | null {
  const { limit } = readLimitDetails(body);

  if (REFUSED_STATUSES.has(status) && getString(limit, "period") === "rolling30Days") {
    return {
      availableAt: getString(limit, "availableAt") ?? "",
      period: "rolling30Days",
      status: "limitReached",
      tier: "free",
    };
  }

  return readRefusedLimit({ body, status });
}
