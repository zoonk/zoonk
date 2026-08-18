import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getSubscriptionOrderBy } from "@/data/subscriptions/_utils/subscription-order";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { prisma } from "@zoonk/db";

export const getUserSubscriptions = cacheAdminData(async (userId: string) => {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: getSubscriptionOrderBy(),
    where: { referenceId: userId },
  });

  return {
    active: findUserActiveSubscription(subscriptions),
    canceled: subscriptions.find((subscription) => subscription.status === "canceled") ?? null,
    incomplete: subscriptions.find((subscription) => subscription.status === "incomplete") ?? null,
  };
});
