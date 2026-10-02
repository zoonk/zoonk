import { loadPostHog } from "@zoonk/core/analytics/posthog-browser";

/**
 * Links browser events to the authenticated Zoonk user and keeps durable person
 * properties current for analytics filters and user lookup.
 */
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

/**
 * Records sessions only for learners whose age allows it. Replay is off at init, so a page never
 * records before this decision.
 */
export async function syncPostHogSessionReplay(allowed: boolean) {
  const posthog = await loadPostHog();

  if (allowed) {
    posthog?.startSessionRecording();
    return;
  }

  posthog?.stopSessionRecording();
}

/**
 * Unlinks future browser events from the previous signed-in user after logout. Callers wait for it
 * before leaving the page, because PostHog loads after the page does.
 */
export async function resetPostHogUser() {
  const posthog = await loadPostHog();
  posthog?.reset();
}
