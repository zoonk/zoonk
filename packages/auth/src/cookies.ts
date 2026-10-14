import { getCookies } from "better-auth/cookies";
import { AUTH_ADVANCED_OPTIONS } from "./config";

/** Resolves the configured session-cookie name through Better Auth so its naming conventions remain authoritative. */
export function getSessionCookieName({ secure }: { secure: boolean }) {
  return getCookies({ advanced: { ...AUTH_ADVANCED_OPTIONS, useSecureCookies: secure } })
    .sessionToken.name;
}

/**
 * Whether a request carries a session cookie, secure or not, whether or not a session is still
 * behind it: a routing hint and a sign that this browser had a session, never proof of one.
 */
export function hasSessionCookie(cookies: { has: (name: string) => boolean }): boolean {
  return [true, false].some((secure) => cookies.has(getSessionCookieName({ secure })));
}
