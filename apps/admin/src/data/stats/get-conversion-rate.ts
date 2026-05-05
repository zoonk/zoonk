import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getConversionRate = cache(async () => {
  const [paid, total] = await Promise.all([
    prisma.subscription.count({ where: { plan: { not: "free" }, status: "active" } }),
    prisma.user.count(),
  ]);

  const rate = total === 0 ? 0 : (paid / total) * 100;

  return { paid, rate, total };
});
