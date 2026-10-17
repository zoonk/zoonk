import "server-only";
import { trackLearnerEvents } from "@zoonk/core/analytics/track-learner-event";

/**
 * Captures a finished sign-in from the web callback each time it hands a session to an app. It
 * goes through the learner sender, so a learner reports their own goal like every other outcome.
 * "Sign Up Completed" goes out when the account is created (`registerSignUpAnalytics`).
 */
export async function trackSignInCompleted({ locale, userId }: { locale: string; userId: string }) {
  await trackLearnerEvents({
    events: [{ name: "Sign In Completed" }],
    locale,
    platform: "web",
    userId,
  });
}
