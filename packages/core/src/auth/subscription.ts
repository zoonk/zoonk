import { type TransactionClient, prisma } from "@zoonk/db";
import { cacheTag, io } from "next/cache";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { getActiveSubscriptionQuery, readActiveSubscription } from "../learner/facts/subscription";
import { getSession } from "../users/get-session";

/** Workflow bridges pass the goal owner, never a caller-selected identity. */
export async function findActiveSubscription(userId: string) {
  await io();
  const now = new Date();

  return findActiveSubscriptionForUser({ now, userId });
}

export function findActiveSubscriptionForUser({
  client = prisma,
  now,
  userId,
}: {
  client?: TransactionClient;
  now: Date;
  userId: string;
}) {
  return client.subscription.findFirst(getActiveSubscriptionQuery({ now, userId }));
}

export async function getActiveSubscription() {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getUserSubscriptionCacheTag(session.user.id));
  return readActiveSubscription(session.user.id);
}

/** Recheck billing for writes so a cached display read cannot preserve canceled access. */
export async function hasActiveSubscription() {
  const session = await getSession();

  if (!session) {
    return false;
  }

  return Boolean(await findActiveSubscription(session.user.id));
}
