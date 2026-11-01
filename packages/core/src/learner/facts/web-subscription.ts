import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../../cache/tags";
import { UNPAID_STATUSES } from "@zoonk/auth/stop-web-plus";
import { readActiveSubscription } from "./subscription";

/** A newer store purchase doesn't stop website billing. Prefer a renewing row over an unpaid one. */
export async function findWebSubscription(userId: string) {
  const findByStatus = (statuses: string[]) =>
    prisma.subscription.findFirst({
      orderBy: { id: "desc" },
      where: {
        provider: "stripe",
        referenceId: userId,
        status: { in: statuses },
        stripeSubscriptionId: { not: null },
      },
    });

  return (await findByStatus(["active"])) ?? (await findByStatus(UNPAID_STATUSES));
}

export async function readWebSubscription(userId: string) {
  "use cache: private";
  cacheTag(getUserSubscriptionCacheTag(userId));
  const active = await readActiveSubscription(userId);

  if (active?.provider === "stripe" && active.status === "active" && active.stripeSubscriptionId) {
    return active;
  }

  return findWebSubscription(userId);
}
