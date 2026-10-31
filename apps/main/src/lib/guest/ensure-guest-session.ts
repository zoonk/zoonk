import { ensureLearnerSummary } from "@/lib/learner/learner-store";
import { carryUsageDataChoiceToAccount } from "@/lib/usage-data/usage-data-choice";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/** Better Auth's captcha plugin answers this code when Vercel BotID flags the browser. */
const BOT_CHECK_REFUSED = "VERIFICATION_FAILED";

/** `blocked`: the bot check refused this browser, so trying again won't help. */
type GuestSession = "blocked" | "failed" | "ready";

/**
 * Only a check that answered "no session" makes a guest: after a failed check, signing in anonymously
 * could replace a signed-in learner's session. The auth client loads on the first tap that needs it.
 */
async function startGuestSession(): Promise<GuestSession> {
  const { data: auth, error: loadError } = await safeAsync(() => import("@zoonk/auth/client"));

  if (loadError) {
    logError("[ensureGuestSession] Could not load the auth client:", loadError);
    return "failed";
  }

  const { authClient } = auth;
  const { data, error: checkError } = await authClient.getSession();

  if (checkError) {
    logError("[ensureGuestSession] Could not check the session:", checkError);
    return "failed";
  }

  if (data) {
    return "ready";
  }

  const { error } = await authClient.signIn.anonymous();

  if (error) {
    logError("[ensureGuestSession] Could not start a guest session:", error);
    return error.code === BOT_CHECK_REFUSED ? "blocked" : "failed";
  }

  // A visitor's choice goes with the guest before its first learning, so the server's events follow it.
  if (!(await carryUsageDataChoiceToAccount())) {
    return "failed";
  }

  ensureLearnerSummary();
  return "ready";
}

let pending: Promise<GuestSession> | null = null;

/** Two callers at once wait for the same sign-in instead of making two guests. */
export function ensureGuestSession(): Promise<GuestSession> {
  pending ??= startGuestSession().finally(() => {
    pending = null;
  });

  return pending;
}
