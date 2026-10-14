import { readCookie, setCookie } from "@zoonk/utils/cookies";

/**
 * A cookie scripts can read beside the auth session's (which they can't): `1` while the browser
 * holds a session, `0` once a read found none in this browsing session, absent when nobody asked
 * yet. It only tells the browser whether reading the learner summary can find anyone; the summary's
 * own read decides who. Only dynamic responses set it (the summary read and the sign-in callback)
 * or the browser itself, never a static page, so pages stay cacheable.
 */
export const SESSION_HINT_COOKIE = "zoonk-signed-in";

const WITH_SESSION = "1";
const WITHOUT_SESSION = "0";

/** The hint's attributes in a `Set-Cookie` header, for a session ending at `expiresAt`. */
export function getSessionHintCookie({
  expiresAt,
  secure,
}: {
  expiresAt: Date;
  secure: boolean;
}): string {
  return [
    `${SESSION_HINT_COOKIE}=${WITH_SESSION}`,
    "Path=/",
    `Expires=${expiresAt.toUTCString()}`,
    "SameSite=Lax",
    secure && "Secure",
  ]
    .filter(Boolean)
    .join("; ");
}

/** A `Set-Cookie` header saying the browser holds no session, until the browser closes. */
export function getNoSessionHintCookie({ secure }: { secure: boolean }): string {
  return [`${SESSION_HINT_COOKIE}=${WITHOUT_SESSION}`, "Path=/", "SameSite=Lax", secure && "Secure"]
    .filter(Boolean)
    .join("; ");
}

/** Whether a request's hint already says the browser holds no session. */
export function saysNoSession(value: string | undefined): boolean {
  return value === WITHOUT_SESSION;
}

/**
 * What the hint says: a session, none, or nothing yet (a session from before the hint, or a new
 * browser), which only a read can tell. Browser only.
 */
export function getSessionHint(): "none" | "session" | "unknown" {
  const value = readCookie(SESSION_HINT_COOKIE);

  if (value === WITH_SESSION) {
    return "session";
  }

  return value === WITHOUT_SESSION ? "none" : "unknown";
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

  await setCookie(SESSION_HINT_COOKIE, WITH_SESSION, { maxAge });
}

/** Says the browser holds no session (signed out, or its session ended). Browser only. */
export async function setNoSessionHint(): Promise<void> {
  await setCookie(SESSION_HINT_COOKIE, WITHOUT_SESSION);
}
