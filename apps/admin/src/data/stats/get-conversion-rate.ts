import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getConversionRate = cacheAdminData(async () => {
  const [paid, total] = await Promise.all([
    prisma.subscription.count({ where: { plan: { not: "free" }, status: "active" } }),
    prisma.user.count(),
  ]);

  const rate = total === 0 ? 0 : (paid / total) * 100;

  return { paid, rate, total };
});
