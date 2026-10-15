import {
  NO_SESSION_HINT,
  SESSION_HINT_HEADER,
  SESSION_HINT_TAG_PATTERN,
} from "@zoonk/auth/session-hint";

/**
 * Better Auth's own session read on Main's auth mount, for the session row itself: never its
 * cookie cache and never a renewal, so a session the server ended (signed out elsewhere, revoked,
 * expired) shows at once and a valid one is only read. The answer to a session that's gone deletes
 * its cookie, with the hint beside it.
 */
const SESSION_CHECK_PATH = "/api/auth/get-session?disableCookieCache=true&disableRefresh=true";

/** How long a check of who holds the session may take before it counts as failed. */
export const SESSION_CHECK_TIMEOUT_MS = 8000;

/**
 * Whose session the server holds for this browser now: the learner's opaque tag (the hint's), or
 * null for nobody. Rejects when the server can't say (offline, an error, more than ≈8 s).
 */
export async function fetchSessionTag(): Promise<string | null> {
  const response = await fetch(SESSION_CHECK_PATH, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`The session check failed with ${response.status}`);
  }

  const tag = response.headers.get(SESSION_HINT_HEADER);

  if (tag === NO_SESSION_HINT) {
    return null;
  }

  if (tag === null || !SESSION_HINT_TAG_PATTERN.test(tag)) {
    throw new Error("The session check didn't say whose session it read");
  }

  return tag;
}
