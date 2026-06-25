import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  completedLessonActivitySql,
  trackedAnalyticsUserSql,
} from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

const cachedCountActiveLearners = cacheAdminData(
  async (currentPeriodStart: Date, previousPeriodStart: Date) => {
    const [currentPeriodResult, previousPeriodResult] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM daily_progress
      JOIN users ON users.id = daily_progress.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND ${completedLessonActivitySql}
        AND date >= ${currentPeriodStart}
    `,
      prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM daily_progress
      JOIN users ON users.id = daily_progress.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND ${completedLessonActivitySql}
        AND date >= ${previousPeriodStart}
        AND date < ${currentPeriodStart}
    `,
    ]);

    return {
      currentPeriod: Number(currentPeriodResult[0].count),
      previousPeriod: Number(previousPeriodResult[0].count),
    };
  },
);

/**
 * The dashboard card compares the current rolling 7-day completion window with
 * the 7 days immediately before it, not a broader 30-day baseline.
 */
export function countActiveLearners({
  currentPeriodStart,
  previousPeriodStart,
}: {
  currentPeriodStart: Date;
  previousPeriodStart: Date;
}) {
  return cachedCountActiveLearners(currentPeriodStart, previousPeriodStart);
}
