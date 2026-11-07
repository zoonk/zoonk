export type PushOutcome =
  | { status: "gone" }
  | { retryAfterMs: number; status: "retry" }
  | { status: "sent" }
  | { status: "skipped" }
  | { status: "unknown" };

const MS_PER_SECOND = 1000;

/** FCM asks for at least a minute before retrying a quota rejection. */
const DEFAULT_RETRY_MS = 60 * MS_PER_SECOND;

function parseRetryAfter(value: string | null): number {
  if (!value) {
    return DEFAULT_RETRY_MS;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * MS_PER_SECOND);
  }

  const at = Date.parse(value);
  return Number.isNaN(at) ? DEFAULT_RETRY_MS : Math.max(0, at - Date.now());
}

const OK = 200;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const GONE = 410;
const TOO_MANY_REQUESTS = 429;
const UNAVAILABLE = 503;

const GONE_APNS_REASONS = new Set(["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"]);

/**
 * Only answers Apple documents as not delivered are acted on: 410 and a bad token drop the token,
 * 429 retries. Any other failure may have been delivered, so it isn't sent again.
 */
export function classifyApnsAnswer({
  reason,
  retryAfter,
  status,
}: {
  reason: string | null;
  retryAfter: string | null;
  status: number;
}): PushOutcome {
  if (status === OK) {
    return { status: "sent" };
  }

  if (status === GONE || (status === BAD_REQUEST && reason && GONE_APNS_REASONS.has(reason))) {
    return { status: "gone" };
  }

  if (status === TOO_MANY_REQUESTS) {
    return { retryAfterMs: parseRetryAfter(retryAfter), status: "retry" };
  }

  return { status: "unknown" };
}

/**
 * FCM's 404 (`UNREGISTERED`) drops the registration; 429 and 503 weren't delivered and retry. A
 * 400 can be our payload as much as the registration, so it never drops one.
 */
export function classifyFcmAnswer({
  retryAfter,
  status,
}: {
  retryAfter: string | null;
  status: number;
}): PushOutcome {
  if (status === OK) {
    return { status: "sent" };
  }

  if (status === NOT_FOUND) {
    return { status: "gone" };
  }

  if (status === TOO_MANY_REQUESTS || status === UNAVAILABLE) {
    return { retryAfterMs: parseRetryAfter(retryAfter), status: "retry" };
  }

  return { status: "unknown" };
}
