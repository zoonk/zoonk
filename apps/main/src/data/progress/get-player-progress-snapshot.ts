import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { hasUserLearningProgress } from "@zoonk/core/progress/user-progress";
import { type UserProgress, prisma } from "@zoonk/db";
import { computeDecayedEnergy } from "@zoonk/utils/energy";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";
import { resolveScoreDateRange } from "./_utils/resolve-score-date-range";
import { type ScoreDateRange } from "./_utils/score-date-range";
import { getTotalLearningDays } from "./get-total-learning-days";
import { getTotalLearningTime } from "./get-total-learning-time";
import { getUserProgress } from "./get-user-progress";

type BestDayScore = { correctAnswers: number; dayOfWeek: number; incorrectAnswers: number };

type BestDayScoreRow = {
  _sum: { correctAnswers: number | null; incorrectAnswers: number | null };
  dayOfWeek: number;
};

type PlayerProgressState = {
  currentEnergy: number;
  hasLearningProgress: boolean;
  lastActiveAt: Date;
  totalBrainPower: number;
};

type TodayProgressState = {
  brainPowerEarned: number;
  energyAtEnd: number;
  interactiveCompleted: number;
  staticCompleted: number;
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
  totalBrainPower: number;
  totalLearningSeconds: number;
};

type PlayerProgressQueryInput = {
  bestDayRange: ScoreDateRange["dailyProgress"];
  today: Date;
  userId: string;
};

type PlayerProgressSnapshotParams = { now?: Date };

type PlayerProgressDates = {
  bestDayRange: ScoreDateRange["dailyProgress"];
  now: Date;
  today: Date;
};

type PlayerProgressQueryData = {
  bestDayScores: BestDayScore[];
  fullEnergyDays: number;
  highestPreviousDailyBrainPower: number;
  todayProgress: TodayProgressState | null;
};

/**
 * The player needs the current Energy value after decay, but new learners may
 * not have a UserProgress row yet. Returning zero keeps first completions able
 * to evaluate daily BP records without pretending the progress query failed.
 */
function getCurrentEnergy({ now, progress }: { now: Date; progress: PlayerProgressState | null }) {
  if (!progress?.hasLearningProgress) {
    return 0;
  }

  return computeDecayedEnergy(progress.currentEnergy, progress.lastActiveAt, now);
}

/**
 * Reuses Score's request-timezone-aware date contract so the player milestone
 * and the Patterns page consider the same 90 learner-local dates. The range's
 * current instant also keeps Energy decay on the same captured clock.
 */
async function resolvePlayerProgressDates(
  params: PlayerProgressSnapshotParams,
): Promise<PlayerProgressDates> {
  const range = await resolveScoreDateRange(params);

  return {
    bestDayRange: range.dailyProgress,
    now: range.stepAttempts.endDate,
    today: range.dailyProgress.endDate,
  };
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
 * Normalizes the canonical UserProgress row before pure milestone selection so
 * database-specific bigint values do not cross the cached query boundary.
 */
function toPlayerProgressState(progress: UserProgress | null): PlayerProgressState | null {
  if (!progress) {
    return null;
  }

  return {
    currentEnergy: progress.currentEnergy,
    hasLearningProgress: hasUserLearningProgress(progress),
    lastActiveAt: progress.lastActiveAt,
    totalBrainPower: Number(progress.totalBrainPower),
  };
}

/**
 * Packages the few pre-completion facts needed to decide whether the next local
 * completion crosses an Energy, full-energy-day, or daily-BP milestone.
 */
function buildPlayerProgressSnapshot({
  learningDays,
  now,
  progress,
  queryData,
  totalLearningSeconds,
}: {
  learningDays: number;
  now: Date;
  progress: PlayerProgressState | null;
  queryData: PlayerProgressQueryData;
  totalLearningSeconds: number;
}): PlayerProgressSnapshot {
  return {
    bestDayScores: queryData.bestDayScores,
    currentEnergy: getCurrentEnergy({ now, progress }),
    fullEnergyDays: queryData.fullEnergyDays,
    highestPreviousDailyBrainPower: queryData.highestPreviousDailyBrainPower,
    learningDays,
    todayBrainPower: queryData.todayProgress?.brainPowerEarned ?? 0,
    todayCompletedLessons:
      (queryData.todayProgress?.interactiveCompleted ?? 0) +
      (queryData.todayProgress?.staticCompleted ?? 0),
    todayEnergyAtEnd: queryData.todayProgress?.energyAtEnd ?? null,
    todayInteractiveLessons: queryData.todayProgress?.interactiveCompleted ?? 0,
    totalBrainPower: progress?.totalBrainPower ?? 0,
    totalLearningSeconds,
  };
}

/**
 * Reads the independent progress facts needed before a lesson completion.
 * Identity and date boundaries are explicit so this leaf has no access to
 * request state and can be shared by prefetched and rendered routes.
 */
async function queryPlayerProgressSnapshot({
  bestDayRange,
  today,
  userId,
}: PlayerProgressQueryInput): Promise<PlayerProgressQueryData> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const data = await Promise.all([
    prisma.dailyProgress.findUnique({ where: { userDate: { date: today, userId } } }),
    prisma.dailyProgress.findFirst({
      orderBy: [{ brainPowerEarned: "desc" }, { date: "desc" }],
      where: { brainPowerEarned: { gt: 0 }, date: { lt: today }, userId },
    }),
    prisma.dailyProgress.count({ where: { energyAtEnd: { gte: 100 }, userId } }),
    prisma.dailyProgress.groupBy({
      _sum: { correctAnswers: true, incorrectAnswers: true },
      by: ["dayOfWeek"],
      orderBy: { dayOfWeek: "asc" },
      where: { date: { gte: bestDayRange.startDate, lte: bestDayRange.endDate }, userId },
    }),
  ]);

  const [todayProgress, highestPreviousDailyProgress, fullEnergyDays, bestDayRows] = data;

  return {
    bestDayScores: getBestDayScores(bestDayRows),
    fullEnergyDays,
    highestPreviousDailyBrainPower: highestPreviousDailyProgress?.brainPowerEarned ?? 0,
    todayProgress: todayProgress
      ? {
          brainPowerEarned: todayProgress.brainPowerEarned,
          energyAtEnd: todayProgress.energyAtEnd,
          interactiveCompleted: todayProgress.interactiveCompleted,
          staticCompleted: todayProgress.staticCompleted,
        }
      : null,
  };
}

async function loadPlayerProgressSnapshot({
  dates,
  userId,
}: {
  dates: PlayerProgressDates;
  userId: string;
}): Promise<PlayerProgressSnapshot> {
  const [queryData, progress, learningDaysData, learningTimeData] = await Promise.all([
    queryPlayerProgressSnapshot({ bestDayRange: dates.bestDayRange, today: dates.today, userId }),
    getUserProgress(),
    getTotalLearningDays(),
    getTotalLearningTime(),
  ]);

  return buildPlayerProgressSnapshot({
    learningDays: learningDaysData?.learningDays ?? 0,
    now: dates.now,
    progress: toPlayerProgressState(progress),
    queryData,
    totalLearningSeconds: learningTimeData?.totalLearningSeconds ?? 0,
  });
}

/**
 * Returns a retryable player snapshot. The optional date keeps integration
 * tests stable without exposing a client-controlled date in production.
 */
export async function getPlayerProgressSnapshot(
  params: PlayerProgressSnapshotParams = {},
): Promise<PlayerProgressSnapshot | null> {
  const { data } = await safeAsync(async () => {
    const [session, dates] = await Promise.all([getSession(), resolvePlayerProgressDates(params)]);

    if (!session) {
      return null;
    }

    return loadPlayerProgressSnapshot({ dates, userId: session.user.id });
  });

  return data;
}
