import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getSubscriptionOrderBy } from "@/data/subscriptions/_utils/subscription-order";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { prisma } from "@zoonk/db";

export const getUserSubscriptions = cacheAdminData(async (userId: string) => {
  const [activeSubscriptions, canceled, incomplete] = await Promise.all([
    prisma.subscription.findMany({
      where: { referenceId: userId, status: { in: ["active", "trialing"] } },
    }),
    prisma.subscription.findFirst({
      orderBy: getCanceledSubscriptionOrderBy(),
      where: { referenceId: userId, status: "canceled" },
    }),
    prisma.subscription.findFirst({
      orderBy: getSubscriptionOrderBy(),
      where: { referenceId: userId, status: "incomplete" },
    }),
  ]);

  return { active: findUserActiveSubscription(activeSubscriptions), canceled, incomplete };
});

/** End dates only break ties for legacy rows without a recorded cancellation time. */
function getCanceledSubscriptionOrderBy() {
  return [
    { canceledAt: { nulls: "last" as const, sort: "desc" as const } },
    { endedAt: { nulls: "last" as const, sort: "desc" as const } },
    { periodEnd: { nulls: "last" as const, sort: "desc" as const } },
    { id: "desc" as const },
  ];
}
