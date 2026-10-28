import "server-only";
import { trackLearnerEvents } from "@zoonk/core/analytics/track-learner-event";

export async function trackSignInCompleted({ locale, userId }: { locale: string; userId: string }) {
  await trackLearnerEvents({
    events: [{ name: "Sign In Completed" }],
    locale,
    platform: "web",
    userId,
  });
}
