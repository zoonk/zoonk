import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";

/**
 * Limits the headline to signup cohorts when a stats period is present while
 * keeping the dashboard overview's all-time behavior when dates are omitted.
 */
function getActivationUserWhere({ start, end }: { start?: Date; end?: Date }) {
  if (!start || !end) {
    return trackedAnalyticsUserWhere;
  }

  return { ...trackedAnalyticsUserWhere, createdAt: { gte: start, lte: end } };
}

/**
 * Activation should follow earned Brain Power instead of lesson progress rows
 * because progress resets can remove lesson rows while preserving the durable
 * learning credit that proves the user completed at least one lesson. Optional
 * dates let the detailed Growth page compare signup cohorts without changing
 * the all-time dashboard metric.
 */
export const getActivationRate = cacheAdminData(async (start?: Date, end?: Date) => {
  const userWhere = getActivationUserWhere({ end, start });

  const [activated, total] = await Promise.all([
    prisma.user.count({
      where: {
        ...userWhere,
        progress: { is: { totalBrainPower: { gte: BigInt(BRAIN_POWER_PER_LESSON) } } },
      },
    }),
    prisma.user.count({ where: userWhere }),
  ]);

  const rate = total === 0 ? 0 : (activated / total) * 100;

  return { activated, rate, total };
});
