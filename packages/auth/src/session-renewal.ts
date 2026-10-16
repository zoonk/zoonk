import {
  BETTER_AUTH_BASE_PATH,
  COOKIE_CACHE_MINUTES,
  SESSION_EXPIRES_IN_DAYS,
  SESSION_UPDATE_AGE_DAYS,
} from "./config";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Where a browser renews its session: a POST to Better Auth's session read, past the cookie's
 * cached copy, which would answer without renewing. It also writes the browser a new copy of the
 * session, renewed or not.
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
 * writes the browser a new copy of the session and nothing else.
 */
export function isSessionRenewalDue({ expiresAt, now }: { expiresAt: number; now: number }) {
  return expiresAt - now <= (SESSION_EXPIRES_IN_DAYS - SESSION_UPDATE_AGE_DAYS) * DAY_MS;
}

/** How long before the browser's copy of the session runs out a page in use asks for a new one. */
const COPY_REFRESH_MARGIN_MINUTES = 10;

/**
 * How old the browser's copy of the session gets before a page in use sends the renewal's POST
 * for a new one: a while before it runs out, so the page's next requests still read the copy
 * while the POST answers, and a learner using the app sends about one every 50 minutes.
 */
export const SESSION_COPY_REFRESH_MS =
  (COOKIE_CACHE_MINUTES - COPY_REFRESH_MARGIN_MINUTES) * MINUTE_MS;
