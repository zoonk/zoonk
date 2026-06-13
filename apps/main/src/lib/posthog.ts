import { getPostHogConfig } from "@zoonk/utils/posthog";
import posthog from "posthog-js";

/**
 * Links browser events to the authenticated Zoonk user and stores the user flag
 * PostHog reports can use to filter internal users out of stats.
 */
export function identifyPostHogUser({
  analyticsDisabled,
  plan,
  userId,
}: {
  analyticsDisabled: boolean;
  plan: string;
  userId: string | null;
}) {
  if (!getPostHogConfig()) {
    return;
  }

  if (!userId) {
    return;
  }

  posthog.identify(userId, { analyticsDisabled, plan });
}

/**
 * Unlinks future browser events from the previous signed-in user after logout.
 */
export function resetPostHogUser() {
  if (!getPostHogConfig()) {
    return;
  }

  posthog.reset();
}
