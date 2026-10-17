/**
 * Main's session hint: a cookie scripts can read beside the auth session's (which they can't). It
 * says `1` while the browser holds a session, `0` once its session cookie was deleted (signed out),
 * and is absent when nothing has said yet. Only the auth responses that set or delete the session
 * cookie write it, so it changes with the session and never on its own. Static pages never write
 * it, so they stay cacheable.
 */
export const SESSION_HINT_COOKIE = "zoonk-signed-in";

export const SESSION_HINT = "1";

export const NO_SESSION_HINT = "0";
