import { BETTER_AUTH_BASE_PATH, SESSION_EXPIRES_IN_DAYS, SESSION_UPDATE_AGE_DAYS } from "./config";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a browser renews its session: a POST to Better Auth's session read, past the cookie's
 * cached copy, which would answer without renewing.
 */
export const SESSION_RENEWAL_PATH = `${BETTER_AUTH_BASE_PATH}/get-session?disableCookieCache=true`;

/**
 * How a browser sends its renewal. Better Auth's router refuses a POST whose body isn't JSON, and
 * Next.js hands over a browser's bodyless POST with an empty body, so it sends an empty JSON object.
 */
export const SESSION_RENEWAL_REQUEST = {
  body: "{}",
  headers: { "content-type": "application/json" },
  method: "POST",
} satisfies RequestInit;

/**
 * Whether a session ending at `expiresAt` is due for its renewal, the same day Better Auth would
 * write it: once it was last renewed at least `SESSION_UPDATE_AGE_DAYS` ago. Earlier, a renewal
 * would only read.
 */
export function isSessionRenewalDue({ expiresAt, now }: { expiresAt: number; now: number }) {
  return expiresAt - now <= (SESSION_EXPIRES_IN_DAYS - SESSION_UPDATE_AGE_DAYS) * DAY_MS;
}
