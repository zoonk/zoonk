import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getDailySignups = cacheAdminData(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE ${trackedAnalyticsUserSql} AND created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return results.map((row) => ({ count: Number(row.count), date: row.date }));
});
