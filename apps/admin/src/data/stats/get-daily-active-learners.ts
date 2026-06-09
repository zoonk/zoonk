import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getDailyActiveLearners = cacheAdminData(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT date, COUNT(DISTINCT user_id) as count
    FROM daily_progress
    JOIN users ON users.id = daily_progress.user_id
    WHERE ${trackedAnalyticsUserSql} AND date >= ${start} AND date <= ${end}
    GROUP BY date
    ORDER BY date ASC
  `;

  return results.map((row) => ({ count: Number(row.count), date: row.date }));
});
