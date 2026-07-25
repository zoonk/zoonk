import "server-only";
import { type UserProgress, prisma } from "@zoonk/db";
import { MAX_ENERGY, projectPersistedEnergy } from "../../progress/energy";
import {
  getTotalLearningDays,
  getTotalLearningTime,
  getUserProgress,
} from "../../progress/progress-metrics";
import { hasUserLearningProgress } from "../../progress/user-progress";
import { type BestDayScore, type PlayerInitialProgress } from "../contracts/progress-snapshot";

type DateRange = { endDate: Date; startDate: Date };

type BestDayScoreRow = {
  _sum: { correctAnswers: number | null; incorrectAnswers: number | null };
  dayOfWeek: number;
};

/** Normalizes nullable database sums into the player snapshot's numeric weekday contract. */
function getBestDayScores(rows: BestDayScoreRow[]): BestDayScore[] {
  return rows.map((row) => ({
    correctAnswers: row._sum.correctAnswers ?? 0,
    dayOfWeek: row.dayOfWeek,
    incorrectAnswers: row._sum.incorrectAnswers ?? 0,
  }));
}

/**
 * Derives Energy from the same aggregate progress row used for Brain Power so
 * the player cannot combine values captured on opposite sides of a completion.
 */
function getCurrentEnergy({
  progress,
  targetDate,
  timeZone,
}: {
  progress: UserProgress | null;
  targetDate: Date;
  timeZone: string;
}): number {
  if (!hasUserLearningProgress(progress)) {
    return 0;
  }

  return projectPersistedEnergy({ persistedEnergy: progress, targetDate, timeZone }).currentEnergy;
}

/**
 * Loads and assembles the complete pre-completion progress snapshot for an
 * authenticated learner. Dates stay explicit so web, native, school, and
 * white-label adapters can supply their own verified request context.
 */
export async function getPlayerProgressSnapshot({
  bestDayRange,
  today,
  timeZone,
  userId,
}: {
  bestDayRange: DateRange;
  today: Date;
  timeZone: string;
  userId: string;
}): Promise<PlayerInitialProgress> {
  const data = await Promise.all([
    prisma.dailyProgress.findUnique({ where: { userDate: { date: today, userId } } }),
    prisma.dailyProgress.findFirst({
      orderBy: [{ brainPowerEarned: "desc" }, { date: "desc" }],
      where: { brainPowerEarned: { gt: 0 }, date: { lt: today }, userId },
    }),
    prisma.dailyProgress.count({ where: { energyAtEnd: { gte: MAX_ENERGY }, userId } }),
    getUserProgress({ userId }),
    prisma.dailyProgress.groupBy({
      _sum: { correctAnswers: true, incorrectAnswers: true },
      by: ["dayOfWeek"],
      orderBy: { dayOfWeek: "asc" },
      where: { date: { gte: bestDayRange.startDate, lte: bestDayRange.endDate }, userId },
    }),
    getTotalLearningDays({ userId }),
    getTotalLearningTime({ userId }),
  ]);

  const [
    todayProgress,
    highestPreviousDailyProgress,
    fullEnergyDays,
    userProgress,
    bestDayRows,
    learningDaysData,
    learningTimeData,
  ] = data;

  return {
    progressSnapshot: {
      bestDayScores: getBestDayScores(bestDayRows),
      currentEnergy: getCurrentEnergy({ progress: userProgress, targetDate: today, timeZone }),
      fullEnergyDays,
      highestPreviousDailyBrainPower: highestPreviousDailyProgress?.brainPowerEarned ?? 0,
      learningDays: learningDaysData.learningDays,
      todayBrainPower: todayProgress?.brainPowerEarned ?? 0,
      todayCompletedLessons:
        (todayProgress?.interactiveCompleted ?? 0) + (todayProgress?.staticCompleted ?? 0),
      todayEnergyAtEnd: todayProgress?.energyAtEnd ?? null,
      todayInteractiveLessons: todayProgress?.interactiveCompleted ?? 0,
      totalLearningSeconds: learningTimeData.totalLearningSeconds,
    },
    totalBrainPower: Number(userProgress?.totalBrainPower ?? 0n),
  };
}
