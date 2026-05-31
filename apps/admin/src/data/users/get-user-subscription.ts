import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { prisma } from "@zoonk/db";

export const getUserSubscription = cacheAdminData(async (userId: string) => {
  const subscriptions = await prisma.subscription.findMany({ where: { referenceId: userId } });

  return findUserActiveSubscription(subscriptions) ?? null;
});
