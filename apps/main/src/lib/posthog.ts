import posthog from "posthog-js";

type PostHogConfig = { host: string; projectToken: string };

/**
 * Reads PostHog config from public environment variables so the SDK can be
 * disabled in environments that do not define both required client values.
 */
export function getPostHogConfig(): PostHogConfig | null {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  if (!host || !projectToken) {
    return null;
  }

  return { host, projectToken };
}

/**
 * Links browser events to the authenticated Zoonk user and stores the user flag
 * PostHog reports can use to filter internal users out of stats.
 */
export function identifyPostHogUser({
  analyticsDisabled,
  userId,
}: {
  analyticsDisabled: boolean;
  userId: string | null;
}) {
  if (!getPostHogConfig()) {
    return;
  }

  if (!userId) {
    return;
  }

  posthog.identify(userId, { analyticsDisabled });
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
