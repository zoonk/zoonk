import { getCookies } from "better-auth/cookies";
import { AUTH_ADVANCED_OPTIONS } from "./config";

export function getSessionCookieName({ secure }: { secure: boolean }) {
  return getCookies({ advanced: { ...AUTH_ADVANCED_OPTIONS, useSecureCookies: secure } })
    .sessionToken.name;
}

/** A routing hint, never proof of a session: the session behind the cookie may be gone. */
export function hasSessionCookie(cookies: { has: (name: string) => boolean }): boolean {
  return [true, false].some((secure) => cookies.has(getSessionCookieName({ secure })));
}
