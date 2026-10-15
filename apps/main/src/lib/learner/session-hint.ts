import {
  LEGACY_SESSION_HINT,
  NO_SESSION_HINT,
  SESSION_HINT_COOKIE,
  describeSessionHint,
} from "@zoonk/auth/session-hint";
import { readCookie, setCookie } from "@zoonk/utils/cookies";

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
 * Leaves the hint for a session the browser now holds, until `expiresAt` (milliseconds), or for
 * this browsing session when that isn't known yet. Browser only.
 */
export async function setSessionHint(expiresAt?: number): Promise<void> {
  const maxAge =
    expiresAt === undefined ? undefined : Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

  await setCookie(SESSION_HINT_COOKIE, LEGACY_SESSION_HINT, { maxAge });
}

/** Says the browser holds no session (signed out, or its session ended). Browser only. */
export async function setNoSessionHint(): Promise<void> {
  await setCookie(SESSION_HINT_COOKIE, NO_SESSION_HINT);
}
