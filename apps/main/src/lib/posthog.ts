import { loadPostHog } from "@zoonk/core/analytics/posthog-browser";

export async function identifyPostHogUser({
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
  if (!userId) {
    return;
  }

  const posthog = await loadPostHog();
  posthog?.identify(userId, { analyticsDisabled, plan, userId, username });
}

/** Callers wait for it before leaving the page, because PostHog loads after the page does. */
export async function resetPostHogUser() {
  const posthog = await loadPostHog();
  posthog?.reset();
}
