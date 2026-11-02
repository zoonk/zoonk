import { NO_SESSION_HINT, SESSION_HINT, SESSION_HINT_COOKIE } from "@zoonk/auth/session-hint";
import { readCookie } from "@zoonk/utils/cookies";

/** It only says whether reading the learner summary can find anyone; the summary's own read decides who. */
export function getSessionHint(): "none" | "session" | "unknown" {
  const value = readCookie(SESSION_HINT_COOKIE);

  if (value === SESSION_HINT) {
    return "session";
  }

  return value === NO_SESSION_HINT ? "none" : "unknown";
}

export function hasSessionHint(): boolean {
  return getSessionHint() === "session";
}
