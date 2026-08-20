import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";

/**
 * Keeps the active and trialing status rule in one query while letting callers
 * choose whether the result is a cached display read or a fresh permission
 * check.
 */
function findActiveSubscription(userId: string) {
  const now = new Date();

  return prisma.subscription.findFirst({
    orderBy: { id: "desc" },
    where: {
      OR: [
        { provider: { not: "apple" } },
        { endedAt: null, periodEnd: { gt: now }, provider: "apple" },
      ],
      referenceId: userId,
      status: { in: ["active", "trialing"] },
    },
  });
}

/**
 * Resolves billing state from the authenticated learner rather than accepting
 * a caller-selected user id. The private cache keeps the full authenticated
 * read together for instant navigation and deduplicates repeated calls in one
 * render tree.
 */
export async function getActiveSubscription() {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getUserSubscriptionCacheTag(session.user.id));
  return findActiveSubscription(session.user.id);
}

/**
 * Rechecks billing state when it controls a write or workflow start. Session
 * resolution is still deduplicated, but a canceled subscription cannot retain
 * write access through a previously cached display read.
 */
export async function hasActiveSubscription() {
  const session = await getSession();

  if (!session) {
    return false;
  }

  return Boolean(await findActiveSubscription(session.user.id));
}
