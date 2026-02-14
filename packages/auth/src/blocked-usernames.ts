import { authAndSecurity } from "./_blocked-usernames/auth-and-security";
import { commercial } from "./_blocked-usernames/commercial";
import { infrastructure } from "./_blocked-usernames/infrastructure";
import { websiteSections } from "./_blocked-usernames/website-sections";
import { httpStatusCodes, zoonkSpecific } from "./_blocked-usernames/zoonk-specific";

/**
 * Reserved usernames that cannot be registered.
 * Combines The Big Username Blocklist (3+ char entries)
 * with Zoonk-specific routes, products, and infrastructure names.
 */
export const BLOCKED_USERNAMES = new Set([
  ...infrastructure,
  ...authAndSecurity,
  ...commercial,
  ...websiteSections,
  ...httpStatusCodes,
  ...zoonkSpecific,
]);
