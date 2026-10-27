import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../../cache/tags";
import { getRequestInstant } from "./request-instant";

/** The shared eligibility query; permission callers supply their own fresh clock and client. */
export function getActiveSubscriptionQuery({ now, userId }: { now: Date; userId: string }) {
  return {
    orderBy: { id: "desc" as const },
    where: {
      OR: [
        { provider: { not: "apple" as const } },
        { endedAt: null, periodEnd: { gt: now }, provider: "apple" as const },
      ],
      referenceId: userId,
      status: { in: ["active", "trialing"] },
    },
  };
}

/** Internal display fact; only an authenticated capability derives the actor for this key. */
export async function readActiveSubscription(userId: string) {
  "use cache: private";

  cacheTag(getUserSubscriptionCacheTag(userId));

  const now = await getRequestInstant();

  return prisma.subscription.findFirst(getActiveSubscriptionQuery({ now, userId }));
}
