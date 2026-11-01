import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../../cache/tags";
import { UNPAID_STATUSES } from "@zoonk/auth/stop-web-plus";

/** A newer store purchase doesn't stop website billing. Prefer a renewing row over an unpaid one. */
export async function findWebSubscription(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { id: "desc" },
    where: {
      provider: "stripe",
      referenceId: userId,
      status: { in: ["active", ...UNPAID_STATUSES] },
      stripeSubscriptionId: { not: null },
    },
  });

  return (
    subscriptions.find((subscription) => subscription.status === "active") ??
    subscriptions[0] ??
    null
  );
}

export async function readWebSubscription(userId: string) {
  "use cache: private";
  cacheTag(getUserSubscriptionCacheTag(userId));
  return findWebSubscription(userId);
}
