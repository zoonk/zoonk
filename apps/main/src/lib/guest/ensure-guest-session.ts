import { ensureLearnerSummary } from "@/lib/learner/learner-store";
import { carryUsageDataChoiceToAccount } from "@/lib/usage-data/usage-data-choice";
import { readBrowserSession } from "@/lib/workflow/auth-headers";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/** Better Auth's captcha plugin answers this code when Vercel BotID flags the browser. */
const BOT_CHECK_REFUSED = "VERIFICATION_FAILED";

/** `blocked`: the bot check refused this browser, so trying again won't help. */
type GuestSession = { learnerId: string; status: "ready" } | { status: "blocked" | "failed" };

const FAILED: GuestSession = { status: "failed" };

/**
 * Only a check that answered "no session" makes a guest: after a failed check, signing in anonymously
 * could replace a signed-in learner's session. The auth client loads on the first tap that needs it.
 */
async function startGuestSession(): Promise<GuestSession> {
  const { data, error: checkError } = await readBrowserSession();

  if (checkError) {
    logError("[ensureGuestSession] Could not check the session:", checkError);
    return FAILED;
  }

  if (data) {
    return { learnerId: data.user.id, status: "ready" };
  }

  const { authClient } = await import("@zoonk/auth/client");
  const { data: guest, error } = await authClient.signIn.anonymous();

  if (error || !guest) {
    logError("[ensureGuestSession] Could not start a guest session:", error);
    return error?.code === BOT_CHECK_REFUSED ? { status: "blocked" } : FAILED;
  }

  // A visitor's choice goes with the guest before its first learning, so the server's events follow it.
  if (!(await carryUsageDataChoiceToAccount())) {
    return FAILED;
  }

  ensureLearnerSummary();
  return { learnerId: guest.user.id, status: "ready" };
}

let pending: Promise<GuestSession> | null = null;

/** Two callers at once wait for the same sign-in instead of making two guests. */
export function ensureGuestSession(): Promise<GuestSession> {
  pending ??= safeAsync(startGuestSession)
    .then(({ data, error }) => {
      if (error) {
        logError("[ensureGuestSession] Could not reach auth:", error);
      }

      return data ?? FAILED;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}
