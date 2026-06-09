import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getPeriodActiveLearners = cacheAdminData(async (start: Date, end: Date) => {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT user_id) as count
    FROM daily_progress
    JOIN users ON users.id = daily_progress.user_id
    WHERE ${trackedAnalyticsUserSql} AND date >= ${start} AND date <= ${end}
  `;

  return Number(result[0].count);
});
