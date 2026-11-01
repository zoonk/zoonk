import "server-only";
import { getActiveSubscriptionQuery } from "@zoonk/auth/active-subscription";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../../cache/tags";
import { getRequestInstant } from "./request-instant";

/** Display-only fact; authenticated capabilities must derive the userId. */
export async function readActiveSubscription(userId: string) {
  "use cache: private";

  cacheTag(getUserSubscriptionCacheTag(userId));

  const now = await getRequestInstant();

  return prisma.subscription.findFirst(getActiveSubscriptionQuery({ now, userId }));
}
