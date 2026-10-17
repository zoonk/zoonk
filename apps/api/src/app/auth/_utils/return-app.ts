import "server-only";
import { isCorsAllowedOrigin } from "@zoonk/utils/origin";
import { MAIN_URL } from "@zoonk/utils/url";

/**
 * The app sign-in goes back to: the Zoonk app that sent the learner here (`redirectTo`'s origin,
 * such as admin), or this environment's main app when none did or the address isn't a Zoonk app.
 */
export function getReturnAppUrl(redirectTo: string | null): string {
  const origin = redirectTo && URL.canParse(redirectTo) ? new URL(redirectTo).origin : null;
  return origin && isCorsAllowedOrigin(origin) ? origin : MAIN_URL;
}
