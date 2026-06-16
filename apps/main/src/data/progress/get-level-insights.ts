import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";
import { getCompletedLessonDayWhere } from "./_utils/completed-lesson-day-where";
import { getProgressDateFilter } from "./_utils/progress-date-filter";

type HighestBpDayData = { brainPower: number; date: Date };

type LevelInsightsData = {
  highestBpDay: HighestBpDayData | null;
  learningDays: number;
  totalLearningSeconds: number;
};

/**
 * A period can have progress rows without any BP earned, for example when only
 * energy decay rows exist. In that case the learning-day and learning-time cards
 * can still report zero while the highest-BP card stays hidden.
 */
function buildLevelInsights({
  highestBpDay,
  learningDays,
  periodProgress,
  totalLearningSeconds,
}: {
  highestBpDay: { brainPowerEarned: number; date: Date } | null;
  learningDays: number;
  periodProgress: { date: Date } | null;
  totalLearningSeconds: number;
}): LevelInsightsData | null {
  if (!periodProgress) {
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

const cachedGetLevelInsights = cache(
  async (
    startDateIso?: string,
    endDateIso?: string,
    headers?: Headers,
  ): Promise<LevelInsightsData | null> => {
    const session = await getSession(headers);

    if (!session) {
      return null;
    }

    const userId = session.user.id;
    const dateFilter = getProgressDateFilter({ endDateIso, startDateIso });

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
      highestBpDay,
      learningDays,
      periodProgress,
      totalLearningSeconds: totalLearningTime._sum.timeSpentSeconds ?? 0,
    });
  },
);

/**
 * Level insight cards share the selected period window with the Brain Power
 * chart. The optional params keep the helper usable for rolling summaries too.
 */
export function getLevelInsights(params?: {
  endDate?: Date;
  headers?: Headers;
  startDate?: Date;
}): Promise<LevelInsightsData | null> {
  return cachedGetLevelInsights(
    params?.startDate?.toISOString(),
    params?.endDate?.toISOString(),
    params?.headers,
  );
}
