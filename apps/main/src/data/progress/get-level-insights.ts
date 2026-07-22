import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCompletedLessonDayWhere } from "./_utils/completed-lesson-day-where";
import { getProgressDateFilter } from "./_utils/progress-date-filter";

type HighestBpDayData = { brainPower: number; date: Date };

type LevelInsightsData = {
  highestBpDay: HighestBpDayData | null;
  learningDays: number;
  totalLearningSeconds: number;
};

type LevelInsightsParams = { endDate?: Date; startDate?: Date };

/**
 * A period can have progress rows without any BP earned, for example when only
 * energy decay rows exist. In that case the learning-day and learning-time cards
 * can still report zero while the highest-BP card stays hidden.
 */
function buildLevelInsights({
  highestBpDay,
  hasPeriodProgress,
  learningDays,
  totalLearningSeconds,
}: {
  hasPeriodProgress: boolean;
  highestBpDay: { brainPowerEarned: number; date: Date } | null;
  learningDays: number;
  totalLearningSeconds: number;
}): LevelInsightsData | null {
  if (!hasPeriodProgress) {
    return null;
  }

  return {
    highestBpDay: highestBpDay
      ? { brainPower: highestBpDay.brainPowerEarned, date: highestBpDay.date }
      : null,
    learningDays,
    totalLearningSeconds,
  };
}

async function findLevelInsights({
  endDate,
  startDate,
  userId,
}: LevelInsightsParams & { userId: string }): Promise<LevelInsightsData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const dateFilter = getProgressDateFilter({ endDate, startDate });

  const [periodProgress, highestBpDay, learningDays, totalLearningTime] = await Promise.all([
    prisma.dailyProgress.findFirst({ where: { date: dateFilter, userId } }),
    prisma.dailyProgress.findFirst({
      orderBy: [{ brainPowerEarned: "desc" }, { date: "desc" }],
      where: { brainPowerEarned: { gt: 0 }, date: dateFilter, userId },
    }),
    prisma.dailyProgress.count({ where: getCompletedLessonDayWhere({ dateFilter, userId }) }),
    prisma.dailyProgress.aggregate({
      _sum: { timeSpentSeconds: true },
      where: { date: dateFilter, userId },
    }),
  ]);

  return buildLevelInsights({
    hasPeriodProgress: Boolean(periodProgress),
    highestBpDay,
    learningDays,
    totalLearningSeconds: totalLearningTime._sum.timeSpentSeconds ?? 0,
  });
}

/**
 * Level insight cards share the selected period window with the Brain Power
 * chart. The optional params keep the helper usable for rolling summaries too.
 */
export async function getLevelInsights(
  params: LevelInsightsParams = {},
): Promise<LevelInsightsData | null> {
  const session = await getSession();
  return session ? findLevelInsights({ ...params, userId: session.user.id }) : null;
}
