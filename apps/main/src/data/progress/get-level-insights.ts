import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";
import { getCompletedLessonDayWhere } from "./_utils/completed-lesson-day-where";
import { getProgressDateFilter } from "./_utils/progress-date-filter";

type HighestBpDayData = { brainPower: number; date: Date };
type LevelInsightsData = { highestBpDay: HighestBpDayData | null; learningDays: number };

/**
 * A period can have progress rows without any BP earned, for example when only
 * energy decay rows exist. In that case the learning-day card can still report
 * zero while the highest-BP card stays hidden.
 */
function buildLevelInsights({
  highestBpDay,
  learningDays,
  periodProgress,
}: {
  highestBpDay: { brainPowerEarned: number; date: Date } | null;
  learningDays: number;
  periodProgress: { date: Date } | null;
}): LevelInsightsData | null {
  if (!periodProgress) {
    return null;
  }

  return {
    highestBpDay: highestBpDay
      ? { brainPower: highestBpDay.brainPowerEarned, date: highestBpDay.date }
      : null,
    learningDays,
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

    const [periodProgress, highestBpDay, learningDays] = await Promise.all([
      prisma.dailyProgress.findFirst({ where: { date: dateFilter, userId } }),
      prisma.dailyProgress.findFirst({
        orderBy: [{ brainPowerEarned: "desc" }, { date: "desc" }],
        where: { brainPowerEarned: { gt: 0 }, date: dateFilter, userId },
      }),
      prisma.dailyProgress.count({ where: getCompletedLessonDayWhere({ dateFilter, userId }) }),
    ]);

    return buildLevelInsights({ highestBpDay, learningDays, periodProgress });
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
