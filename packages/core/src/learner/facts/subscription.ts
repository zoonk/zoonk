import "server-only";
import { prisma } from "@zoonk/db";
import { type SubscriptionProvider } from "@zoonk/utils/subscription";
import { cacheTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../../cache/tags";
import { getRequestInstant } from "./request-instant";

/** App stores report a period end, so their access lapses on time even if a notification is lost. */
const STORE_PROVIDERS: SubscriptionProvider[] = ["apple", "google"];

/** The shared eligibility query; permission callers supply their own fresh clock and client. */
export function getActiveSubscriptionQuery({ now, userId }: { now: Date; userId: string }) {
  return {
    orderBy: { id: "desc" as const },
    where: {
      OR: [
        { provider: { notIn: STORE_PROVIDERS } },
        { endedAt: null, periodEnd: { gt: now }, provider: { in: STORE_PROVIDERS } },
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
