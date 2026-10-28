import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";

function getActivationUserWhere({ start, end }: { start?: Date; end?: Date }) {
  if (!start || !end) {
    return trackedAnalyticsUserWhere;
  }

  return { ...trackedAnalyticsUserWhere, createdAt: { gte: start, lte: end } };
}

/** Brain Power, not lesson progress rows: a progress reset removes the rows but keeps the credit. */
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
