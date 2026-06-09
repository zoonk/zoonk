import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";

/**
 * Activation should follow earned Brain Power instead of lesson progress rows
 * because progress resets can remove lesson rows while preserving the durable
 * learning credit that proves the user completed at least one lesson.
 */
export const getActivationRate = cacheAdminData(async () => {
  const [activated, total] = await Promise.all([
    prisma.user.count({
      where: {
        ...trackedAnalyticsUserWhere,
        progress: { is: { totalBrainPower: { gte: BigInt(BRAIN_POWER_PER_LESSON) } } },
      },
    }),
    prisma.user.count({ where: trackedAnalyticsUserWhere }),
  ]);

  const rate = total === 0 ? 0 : (activated / total) * 100;

  return { activated, rate, total };
});
