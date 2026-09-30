import { getCookies } from "better-auth/cookies";
import { AUTH_ADVANCED_OPTIONS } from "./config";

/**
 * Set while the session belongs to an account rather than a guest (`accountMarkerPlugin`), so the
 * web proxy tells them apart without a database read.
 */
export const ACCOUNT_MARKER_COOKIE = "zoonk_account";

/** Resolves the configured session-cookie name through Better Auth so its naming conventions remain authoritative. */
export function getSessionCookieName({ secure }: { secure: boolean }) {
  return getCookies({ advanced: { ...AUTH_ADVANCED_OPTIONS, useSecureCookies: secure } })
    .sessionToken.name;
}
