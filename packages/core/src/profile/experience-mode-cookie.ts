import { type ExperienceMode } from "@zoonk/db";

/**
 * The mode on this device. Visitors without a session keep their pick here, and the profile's mode
 * wins once saved. Learner pages also leave the mode they render in, so the skeleton a hard load
 * paints before the learner's data arrives takes the same look. Scripts read it, so it isn't
 * `httpOnly`; a look is all it holds.
 */
export const EXPERIENCE_MODE_COOKIE = "zoonk_mode";

/** A year. */
export const EXPERIENCE_MODE_COOKIE_MAX_AGE_SECONDS = 31_536_000;

/** The cookie in a `Cookie` header or `document.cookie`, capturing its mode. */
export const EXPERIENCE_MODE_COOKIE_PATTERN = new RegExp(
  `(?:^|;\\s*)${EXPERIENCE_MODE_COOKIE}=(focus|fun)(?:;|$)`,
  "u",
);

/** The mode this device keeps, or null when it keeps none (or anything that isn't a mode). */
export function readExperienceModeCookie(cookies: string): ExperienceMode | null {
  const mode = EXPERIENCE_MODE_COOKIE_PATTERN.exec(cookies)?.[1];
  return mode === "focus" || mode === "fun" ? mode : null;
}

function setDocumentCookie(cookie: string) {
  // oxlint-disable-next-line unicorn/no-document-cookie -- Safari before 18.4 has no Cookie Store API, and every learner's browser needs this cookie.
  document.cookie = cookie;
}

/** Keeps `mode` on this device from the browser, as the server keeps it. */
export function writeExperienceModeCookie(mode: ExperienceMode) {
  setDocumentCookie(
    `${EXPERIENCE_MODE_COOKIE}=${mode}; Max-Age=${EXPERIENCE_MODE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`,
  );
}

/** Forgets the mode on this device from the browser, as signing out does. */
export function clearExperienceModeCookie() {
  setDocumentCookie(`${EXPERIENCE_MODE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`);
}
