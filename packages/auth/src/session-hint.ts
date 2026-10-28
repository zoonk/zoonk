/**
 * Readable by scripts, unlike the session cookie: `1` while a session cookie exists, `0` after
 * sign-out, absent when unknown. Only auth responses write it, so static pages stay cacheable.
 */
export const SESSION_HINT_COOKIE = "zoonk-signed-in";

export const SESSION_HINT = "1";

export const NO_SESSION_HINT = "0";
