import { getPostHogConfig } from "@zoonk/utils/posthog";
import posthog from "posthog-js";

/**
 * Links browser events to the authenticated Zoonk user and keeps durable person
 * properties current for analytics filters and user lookup.
 */
export function identifyPostHogUser({
  analyticsDisabled,
  plan,
  userId,
  username,
}: {
  analyticsDisabled: boolean;
  plan: string;
  userId: string | null;
  username: string | null;
}) {
  if (!getPostHogConfig()) {
    return;
  }

  if (!userId) {
    return;
  }

  posthog.identify(userId, { analyticsDisabled, plan, userId, username });
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
