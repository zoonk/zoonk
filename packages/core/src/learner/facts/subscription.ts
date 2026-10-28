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
        { provider: { notIn: ["apple" as const, "google" as const] } },
        { endedAt: null, periodEnd: { gt: now }, provider: "apple" as const },
        /**
         * Google keeps a renewing subscription through its renewal and the silent grace after a
         * failed payment, until a read of it says otherwise (`checkGooglePlayRenewal`); a canceled
         * one lapses at its period end.
         */
        {
          OR: [{ cancelAtPeriodEnd: false }, { periodEnd: { gt: now } }],
          endedAt: null,
          provider: "google" as const,
        },
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
