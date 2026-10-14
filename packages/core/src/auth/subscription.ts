import { type TransactionClient, prisma } from "@zoonk/db";
import { cacheTag, io } from "next/cache";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";

/**
 * Keeps the active and trialing status rule in one query while letting callers
 * choose whether the result is a cached display read or a fresh permission
 * check. Workflow bridges pass the owner of the goal they work for, never a
 * caller's choice.
 */
export async function findActiveSubscription(userId: string) {
  /** A session's private read can be prefetched separately; the fresh check owns its clock. */
  await io();
  const now = new Date();

  return findActiveSubscriptionForUser({ now, userId });
}

/** Internal fresh permission query shared by normal reads and atomic entitlement writes. */
export function findActiveSubscriptionForUser({
  client = prisma,
  now,
  userId,
}: {
  client?: TransactionClient;
  now: Date;
  userId: string;
}) {
  return client.subscription.findFirst({
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
