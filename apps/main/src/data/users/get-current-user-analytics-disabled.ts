import "server-only";
import { getUserSessionCacheTag } from "@/data/cache-tags";
import { getActiveSubscription } from "@/data/subscriptions/get-active-subscription";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

async function findAnalyticsUser(userId: string) {
  "use cache";

  cacheTag(getUserSessionCacheTag(userId));

  return prisma.user.findUnique({
    select: { analyticsDisabled: true, id: true, username: true },
    where: { id: userId },
  });
}

/**
 * Resolves analytics identity and billing for the current browser without
 * exposing user identity as caller-provided data.
 */
export async function getCurrentUserAnalyticsState() {
  const session = await getSession();

  if (!session) {
    return { analyticsDisabled: false, plan: "free", userId: null, username: null };
  }

  const [subscription, user] = await Promise.all([
    getActiveSubscription(),
    findAnalyticsUser(session.user.id),
  ]);

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
