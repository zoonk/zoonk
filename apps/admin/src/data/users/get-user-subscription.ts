import "server-only";
import { findUserActiveSubscription } from "@/data/users/find-active-subscription";
import { isAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getUserSubscription = cache(async function getUserSubscription(userId: string) {
  if (!(await isAdmin())) {
    return null;
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { referenceId: userId },
  });

  return findUserActiveSubscription(subscriptions) ?? null;
});
