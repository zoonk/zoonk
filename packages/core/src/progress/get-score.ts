import "server-only";
import { prisma } from "@zoonk/db";
import {
  type ProgressHistoryOptions,
  dailyProgressInWindow,
  readLifetimeDailyProgress,
} from "./_utils/daily-progress-rows";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScoreDateRange } from "./score-date-range";
import {
  type ScorePerformance,
  getCombinedScorePerformance,
  getScorePerformance,
} from "./score-performance";

async function findScore({
  endDate,
  startDate,
  userId,
}: {
  endDate: Date;
  startDate: Date;
  userId: string;
}): Promise<ScorePerformance | null> {
  const result = await prisma.dailyProgress.aggregate({
    _sum: { correctAnswers: true, incorrectAnswers: true },
    where: { date: { gte: startDate, lte: endDate }, userId },
  });

  return getScorePerformance({
    correctAnswers: result._sum.correctAnswers ?? 0,
    incorrectAnswers: result._sum.incorrectAnswers ?? 0,
  });
}

/** Uses exactly 90 learner-local dates; null without answers or a session. */
export async function getScore({
  history,
}: ProgressHistoryOptions = {}): Promise<ScorePerformance | null> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return null;
  }

  const dateRange = getScoreDateRange({
    now: dateContext.currentInstant,
    timeZone: dateContext.timeZone,
  });

  if (history === "lifetime") {
    const rows = dailyProgressInWindow({
      ...dateRange,
      rows: await readLifetimeDailyProgress(session.user.id),
    });

    return getCombinedScorePerformance(rows);
  }

  return findScore({ ...dateRange, userId: session.user.id });
}
