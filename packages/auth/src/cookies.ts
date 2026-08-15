import { getCookies } from "better-auth/cookies";
import { AUTH_ADVANCED_OPTIONS } from "./config";

/** Resolves the configured session-cookie name through Better Auth so its naming conventions remain authoritative. */
export function getSessionCookieName({ secure }: { secure: boolean }) {
  return getCookies({ advanced: { ...AUTH_ADVANCED_OPTIONS, useSecureCookies: secure } })
    .sessionToken.name;
}
