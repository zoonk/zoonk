import "server-only";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getCurrentUser } from "@zoonk/core/users/current";

/**
 * Resolves analytics identity and billing for the current browser without
 * exposing user identity as caller-provided data.
 */
export async function getCurrentUserAnalyticsState() {
  const [subscription, user] = await Promise.all([getActiveSubscription(), getCurrentUser()]);

  if (!user) {
    return { analyticsDisabled: false, plan: "free", userId: null, username: null };
  }

  return {
    analyticsDisabled: user.analyticsDisabled,
    plan: subscription?.plan ?? "free",
    userId: user.id,
    username: user.username,
  };
}

/**
 * Preserves the existing boolean helper for call sites that only need to know
 * whether the current user should be excluded from analytics.
 */
export async function getCurrentUserAnalyticsDisabled() {
  const { analyticsDisabled } = await getCurrentUserAnalyticsState();
  return analyticsDisabled;
}
