import { BETTER_AUTH_BASE_PATH, COOKIE_CACHE_MINUTES } from "./config";

const MINUTE_MS = 60 * 1000;

/**
 * Where a browser gets a new copy of its session: Better Auth's session read, past the copy it
 * would otherwise answer from, so it reads the database and writes the browser a new copy. Like any
 * read of the database, it also renews a session last renewed a day or more ago.
 */
export const SESSION_REFRESH_PATH = `${BETTER_AUTH_BASE_PATH}/get-session?disableCookieCache=true`;

/** How long before the browser's copy of the session runs out a page in use asks for a new one. */
const COPY_REFRESH_MARGIN_MINUTES = 10;

/**
 * How old the browser's copy of the session gets before a page in use asks for a new one: a while
 * before it runs out, so the page's next requests still read the copy while the request answers,
 * and a learner using the app sends about one every 50 minutes.
 */
export const SESSION_COPY_REFRESH_MS =
  (COOKIE_CACHE_MINUTES - COPY_REFRESH_MARGIN_MINUTES) * MINUTE_MS;
