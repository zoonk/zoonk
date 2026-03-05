import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getUserSubscription = cache(async function getUserSubscription(userId: number) {
  if (!(await isAdmin())) {
    return null;
  }

  return prisma.subscription.findFirst({
    orderBy: { id: "desc" },
    where: { referenceId: String(userId) },
  });
});
