import "server-only";
import { trackLearnerEvents } from "@zoonk/core/analytics/track-learner-event";
import { signedUpFromGuest } from "@zoonk/core/guests/signed-up-from-guest";

type AuthCompletionAction = "sign-in" | "sign-up";

/**
 * Captures completed auth outcomes from the web callback because that route
 * already knows whether the returning session still needs first-time setup.
 * They go through the learner sender, so a learner (or a guest who signs up with
 * a goal) reports their own goal like every other outcome.
 */
export async function trackAuthCompleted({
  action,
  locale,
  userId,
}: {
  action: AuthCompletionAction;
  locale: string;
  userId: string;
}) {
  // A guest who signs up brings their learning, so it's already on the new account here.
  const event =
    action === "sign-in"
      ? ({ name: "Sign In Completed" } as const)
      : ({
          name: "Sign Up Completed",
          properties: { from_guest: await signedUpFromGuest() },
        } as const);

  await trackLearnerEvents({ events: [event], locale, platform: "web", userId });
}
