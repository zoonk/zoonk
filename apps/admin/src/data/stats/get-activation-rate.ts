import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  trackedAnalyticsUserSql,
  trackedAnalyticsUserWhere,
} from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getActivationRate = cacheAdminData(async () => {
  const [activatedResult, total] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM lesson_progress
      JOIN users ON users.id = lesson_progress.user_id
      WHERE ${trackedAnalyticsUserSql} AND completed_at IS NOT NULL
    `,
    prisma.user.count({ where: trackedAnalyticsUserWhere }),
  ]);

  const activated = Number(activatedResult[0].count);
  const rate = total === 0 ? 0 : (activated / total) * 100;

  return { activated, rate, total };
});
