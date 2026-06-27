import "server-only";
import { hasUserLearningProgress } from "@zoonk/core/progress/user-progress";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { DEFAULT_PROGRESS_LOOKBACK_DAYS } from "@zoonk/utils/date-ranges";
import { computeDecayedEnergy, toUTCMidnight } from "@zoonk/utils/energy";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { getCompletedLessonDayWhere } from "./_utils/completed-lesson-day-where";

type BestDayScore = { correctAnswers: number; dayOfWeek: number; incorrectAnswers: number };

type BestDayScoreRow = {
  _sum: { correctAnswers: number | null; incorrectAnswers: number | null };
  dayOfWeek: number;
};

type PlayerProgressSnapshot = {
  bestDayScores: BestDayScore[];
  currentEnergy: number;
  fullEnergyDays: number;
  highestPreviousDailyBrainPower: number;
  learningDays: number;
  todayBrainPower: number;
  todayCompletedLessons: number;
  todayEnergyAtEnd: number | null;
  todayInteractiveLessons: number;
  totalLearningSeconds: number;
};

/**
 * The player needs the current Energy value after decay, but new learners may
 * not have a UserProgress row yet. Returning zero keeps first completions able
 * to evaluate daily BP records without pretending the progress query failed.
 */
function getCurrentEnergy({
  now,
  progress,
}: {
  now: Date;
  progress: Awaited<ReturnType<typeof prisma.userProgress.findUnique>>;
}) {
  if (!hasUserLearningProgress(progress)) {
    return 0;
  }

  return computeDecayedEnergy(progress.currentEnergy, progress.lastActiveAt, now);
}

/**
 * The score page uses a rolling 90-day default for best-day insights. The
 * player receives the same window, based on the injected test clock, so a
 * milestone and the page it links to agree on the learner's strongest weekday.
 */
function getBestDayStartDate(now: Date) {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - DEFAULT_PROGRESS_LOOKBACK_DAYS,
    ),
  );
}

/**
 * Grouped progress rows return nullable sums. The player only needs simple
 * numeric weekday totals, so this normalizes missing sums before the data
 * crosses into the shared package.
 */
function getBestDayScores(rows: BestDayScoreRow[]): BestDayScore[] {
  return rows.map((row) => ({
    correctAnswers: row._sum.correctAnswers ?? 0,
    dayOfWeek: row.dayOfWeek,
    incorrectAnswers: row._sum.incorrectAnswers ?? 0,
  }));
}

/**
 * Packages the few pre-completion facts needed to decide whether the next local
 * completion crosses an Energy, full-energy-day, or daily-BP milestone.
 */
function buildPlayerProgressSnapshot({
  bestDayScores,
  fullEnergyDays,
  highestPreviousDailyProgress,
  learningDays,
  now,
  progress,
  todayProgress,
  totalLearningSeconds,
}: {
  bestDayScores: BestDayScore[];
  fullEnergyDays: number;
  highestPreviousDailyProgress: Awaited<ReturnType<typeof prisma.dailyProgress.findFirst>>;
  learningDays: number;
  now: Date;
  progress: Awaited<ReturnType<typeof prisma.userProgress.findUnique>>;
  todayProgress: Awaited<ReturnType<typeof prisma.dailyProgress.findUnique>>;
  totalLearningSeconds: number;
}): PlayerProgressSnapshot {
  return {
    bestDayScores,
    currentEnergy: getCurrentEnergy({ now, progress }),
    fullEnergyDays,
    highestPreviousDailyBrainPower: highestPreviousDailyProgress?.brainPowerEarned ?? 0,
    learningDays,
    todayBrainPower: todayProgress?.brainPowerEarned ?? 0,
    todayCompletedLessons:
      (todayProgress?.interactiveCompleted ?? 0) + (todayProgress?.staticCompleted ?? 0),
    todayEnergyAtEnd: todayProgress?.energyAtEnd ?? null,
    todayInteractiveLessons: todayProgress?.interactiveCompleted ?? 0,
    totalLearningSeconds,
  };
}

const cachedGetPlayerProgressSnapshot = cache(
  async (nowIso?: string, headers?: Headers): Promise<PlayerProgressSnapshot | null> => {
    const session = await getSession(headers);

    if (!session) {
      return null;
    }

    const now = nowIso ? new Date(nowIso) : new Date();
    const today = toUTCMidnight(now);
    const bestDayStartDate = getBestDayStartDate(now);
    const userId = session.user.id;

    const { data, error } = await safeAsync(() =>
      Promise.all([
        prisma.userProgress.findUnique({ where: { userId } }),
        prisma.dailyProgress.findUnique({ where: { userDate: { date: today, userId } } }),
        prisma.dailyProgress.findFirst({
          orderBy: [{ brainPowerEarned: "desc" }, { date: "desc" }],
          where: { brainPowerEarned: { gt: 0 }, date: { lt: today }, userId },
        }),
        prisma.dailyProgress.count({ where: { energyAtEnd: { gte: 100 }, userId } }),
        prisma.dailyProgress.count({ where: getCompletedLessonDayWhere({ userId }) }),
        prisma.dailyProgress.aggregate({ _sum: { timeSpentSeconds: true }, where: { userId } }),
        prisma.dailyProgress.groupBy({
          _sum: { correctAnswers: true, incorrectAnswers: true },
          by: ["dayOfWeek"],
          orderBy: { dayOfWeek: "asc" },
          where: { date: { gte: bestDayStartDate }, userId },
        }),
      ]),
    );

    if (error) {
      return null;
    }

    const [
      progress,
      todayProgress,
      highestPreviousDailyProgress,
      fullEnergyDays,
      learningDays,
      totalLearningTime,
      bestDayRows,
    ] = data;

    return buildPlayerProgressSnapshot({
      bestDayScores: getBestDayScores(bestDayRows),
      fullEnergyDays,
      highestPreviousDailyProgress,
      learningDays,
      now,
      progress,
      todayProgress,
      totalLearningSeconds: totalLearningTime._sum.timeSpentSeconds ?? 0,
    });
  },
);

/**
 * Returns the pre-completion progress snapshot used by the player milestone
 * system. The optional date keeps integration tests stable without exposing a
 * client-controlled date in production.
 */
export function getPlayerProgressSnapshot(params?: {
  headers?: Headers;
  now?: Date;
}): Promise<PlayerProgressSnapshot | null> {
  return cachedGetPlayerProgressSnapshot(params?.now?.toISOString(), params?.headers);
}
