import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const countActiveLearners = cacheAdminData(
  async (sevenDaysAgo: Date, thirtyDaysAgo: Date) => {
    const [last7DaysResult, last30DaysResult] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM daily_progress
      JOIN users ON users.id = daily_progress.user_id
      WHERE ${trackedAnalyticsUserSql} AND date >= ${sevenDaysAgo}
    `,
      prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM daily_progress
      JOIN users ON users.id = daily_progress.user_id
      WHERE ${trackedAnalyticsUserSql} AND date >= ${thirtyDaysAgo}
    `,
    ]);

    return {
      last30Days: Number(last30DaysResult[0].count),
      last7Days: Number(last7DaysResult[0].count),
    };
  },
);
