import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getPeriodActiveLearners = cache(async (start: Date, end: Date) => {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT user_id) as count
    FROM daily_progress
    WHERE date >= ${start} AND date <= ${end}
  `;

  return Number(result[0].count);
});
