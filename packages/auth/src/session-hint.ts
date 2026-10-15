/**
 * Main's session hint: a cookie scripts can read beside the auth session's (which they can't). It
 * names who the browser's session belongs to with an opaque per-learner tag (never their id, never
 * a credential), says `0` once the browser holds no session, and is absent when nothing has said
 * yet. Only the auth responses that set or delete the session cookie write it, so it changes with
 * the session and never on its own. Static pages never write it, so they stay cacheable.
 */
export const SESSION_HINT_COOKIE = "zoonk-signed-in";

/** The hint an auth response wrote (or, for a session read, the one its session has), for scripts. */
export const SESSION_HINT_HEADER = "x-zoonk-session-hint";

export const NO_SESSION_HINT = "0";

/** What browsers kept from before tags: a session whose learner the hint can't name. */
export const LEGACY_SESSION_HINT = "1";

/** `t1.` and the first 16 bytes of the tag's HMAC in base64url (`session-hint-tag.ts`). */
export const SESSION_HINT_TAG_PATTERN = /^t1\.[\w-]{22}$/u;

function isSessionHintTag(value: string | null | undefined): value is string {
  return typeof value === "string" && SESSION_HINT_TAG_PATTERN.test(value);
}

/**
 * What a hint value says: a session (a learner's tag, or a session from before tags), none, or
 * nothing anyone can rely on (absent, malformed, or a tag version this code doesn't know).
 */
export function describeSessionHint(
  value: string | null | undefined,
): "none" | "session" | "unknown" {
  if (value === NO_SESSION_HINT) {
    return "none";
  }

  return value === LEGACY_SESSION_HINT || isSessionHintTag(value) ? "session" : "unknown";
}
