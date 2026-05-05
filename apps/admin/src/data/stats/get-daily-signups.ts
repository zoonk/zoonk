import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getDailySignups = cache(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return results.map((row) => ({ count: Number(row.count), date: row.date }));
});
