import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const countActiveLearners = cache(async (sevenDaysAgo: Date, thirtyDaysAgo: Date) => {
  const [last7DaysResult, last30DaysResult] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM daily_progress
      WHERE date >= ${sevenDaysAgo}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM daily_progress
      WHERE date >= ${thirtyDaysAgo}
    `,
  ]);

  return {
    last30Days: Number(last30DaysResult[0].count),
    last7Days: Number(last7DaysResult[0].count),
  };
});
