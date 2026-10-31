import { type BirthYearOutcome, askBirthYear, saveBirthYear } from "@/lib/age/birth-year-request";
import { checkBirthYearAction } from "@/lib/age/check-birth-year-action";
import { ensureLearnerSummary } from "@/lib/learner/learner-store";
import { carryUsageDataChoiceToAccount } from "@/lib/usage-data/usage-data-choice";
import { type authClient as AuthClient } from "@zoonk/auth/client";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/** Better Auth's captcha plugin answers this code when Vercel BotID flags the browser. */
const BOT_CHECK_REFUSED = "VERIFICATION_FAILED";

/**
 * `blocked`: the bot check refused this browser, so trying again won't help. `cancelled`: the
 * visitor didn't give their birth year, so nothing started and nothing went wrong.
 */
type GuestSession = "blocked" | "cancelled" | "failed" | "ready";

/**
 * The year is checked before the guest exists, so nobody below the minimum age gets an account, and
 * a visitor's usage data choice is on the account before any learning. A try after a failed save
 * already has its guest, so it only saves again.
 */
async function startGuestWithBirthYear({
  authClient,
  birthYear,
}: {
  authClient: typeof AuthClient;
  birthYear: number;
}): Promise<BirthYearOutcome> {
  const check = await checkBirthYearAction(birthYear).catch(() => null);

  if (!check) {
    return { status: "failed" };
  }

  if (check.status !== "allowed") {
    return check.status === "belowMinimumAge" ? check : { status: "invalid" };
  }

  const { data } = await authClient.getSession();

  if (!data) {
    const { error } = await authClient.signIn.anonymous();

    if (error) {
      logError("[ensureGuestSession] Could not start a guest session:", error);
      return { status: error.code === BOT_CHECK_REFUSED ? "blocked" : "failed" };
    }
  }

  const saved = await saveBirthYear(birthYear);

  if (saved.status === "belowMinimumAge") {
    return saved;
  }

  if (saved.status !== "saved") {
    return { ...saved, guestStarted: true };
  }

  const carried = await carryUsageDataChoiceToAccount({ withYes: false });
  return carried ? saved : { guestStarted: true, status: "failed" };
}

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

  const asked = await askBirthYear({
    signedIn: false,
    submit: (birthYear) => startGuestWithBirthYear({ authClient, birthYear }),
  });

  if (asked !== "saved") {
    return asked;
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
