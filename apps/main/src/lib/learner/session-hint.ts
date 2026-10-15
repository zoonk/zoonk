import {
  NO_SESSION_HINT,
  SESSION_HINT_COOKIE,
  SESSION_HINT_TAG_PATTERN,
  describeSessionHint,
} from "@zoonk/auth/session-hint";
import { readCookie } from "@zoonk/utils/cookies";

/**
 * What the browser's session hint (`@zoonk/auth/session-hint`) says: a session (a learner's tag, or
 * one from before tags), none, or nothing yet (a new browser, or a hint nobody can read), which
 * only a read can tell. It only tells the browser whether reading the learner summary can find
 * anyone; the summary's own read decides who. Browser only.
 */
export function getSessionHint(): "none" | "session" | "unknown" {
  return describeSessionHint(readCookie(SESSION_HINT_COOKIE));
}

/** Whether the hint says the browser holds a session. Browser only. */
export function hasSessionHint(): boolean {
  return getSessionHint() === "session";
}

/**
 * Whose session the hint names: the learner's opaque tag, null for nobody (`0`), or undefined when
 * it names no one (absent, a hint from before tags, or one this code can't read), which only a
 * session read can tell. Only the auth responses that set or delete the session cookie write it,
 * so it changes exactly when the browser's session does. Browser only.
 */
export function readSessionHintTag(): string | null | undefined {
  const value = readCookie(SESSION_HINT_COOKIE);

  if (value === NO_SESSION_HINT) {
    return null;
  }

  return value !== null && SESSION_HINT_TAG_PATTERN.test(value) ? value : undefined;
}
