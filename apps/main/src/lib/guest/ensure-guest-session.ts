import { ensureLearnerSummary } from "@/lib/learner/learner-store";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * Only a check that answered "no session" makes a guest: after a failed check, signing in anonymously
 * could replace a signed-in learner's session. The auth client loads on the first tap that needs it.
 */
async function startGuestSession(): Promise<boolean> {
  const { data: auth, error: loadError } = await safeAsync(() => import("@zoonk/auth/client"));

  if (loadError) {
    logError("[ensureGuestSession] Could not load the auth client:", loadError);
    return false;
  }

  const { authClient } = auth;
  const { data, error: checkError } = await authClient.getSession();

  if (checkError) {
    logError("[ensureGuestSession] Could not check the session:", checkError);
    return false;
  }

  if (data) {
    return true;
  }

  const { error } = await authClient.signIn.anonymous();

  if (error) {
    logError("[ensureGuestSession] Could not start a guest session:", error);
    return false;
  }

  ensureLearnerSummary();
  return true;
}

let pending: Promise<boolean> | null = null;

/** Two callers at once wait for the same sign-in instead of making two guests. */
export function ensureGuestSession(): Promise<boolean> {
  pending ??= startGuestSession().finally(() => {
    pending = null;
  });

  return pending;
}
