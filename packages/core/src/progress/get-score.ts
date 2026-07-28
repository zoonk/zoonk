import "server-only";
import { prisma } from "@zoonk/db";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScoreDateRange } from "./score-date-range";
import { type ScorePerformance, getScorePerformance } from "./score-performance";

/**
 * Loads only the weighted answer totals needed by compact Score surfaces such
 * as Home, while sharing the same rolling date contract as the detail page.
 */
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

/**
 * Returns the authenticated learner's weighted Score for the current 90 local dates.
 */
export async function getScore(): Promise<ScorePerformance | null> {
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

  return findScore({ ...dateRange.dailyProgress, userId: session.user.id });
}
