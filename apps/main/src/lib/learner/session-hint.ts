import { NO_SESSION_HINT, SESSION_HINT, SESSION_HINT_COOKIE } from "@zoonk/auth/session-hint";
import { readCookie } from "@zoonk/utils/cookies";

/**
 * What the browser's session hint (`@zoonk/auth/session-hint`) says: a session, none, or nothing
 * yet (a new browser, or a hint nobody can read), which only a read can tell. It only tells the
 * browser whether reading the learner summary can find anyone; the summary's own read decides who.
 * Browser only.
 */
export function getSessionHint(): "none" | "session" | "unknown" {
  const value = readCookie(SESSION_HINT_COOKIE);

  if (value === SESSION_HINT) {
    return "session";
  }

  return value === NO_SESSION_HINT ? "none" : "unknown";
}

/** Whether the hint says the browser holds a session. Browser only. */
export function hasSessionHint(): boolean {
  return getSessionHint() === "session";
}
