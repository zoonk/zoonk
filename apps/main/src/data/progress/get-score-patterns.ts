import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type ScoreDateRange, type ScoreRangeParams } from "@zoonk/core/progress/score-date-range";
import { type Sql, prisma, sql } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cacheTag } from "next/cache";
import { resolveScoreDateRange } from "./_utils/resolve-score-date-range";
import {
  type ScorePerformance,
  getScorePerformance,
  getStrongestScorePerformance,
} from "./_utils/score-performance";

type WeekdayScorePerformance = ScorePerformance & { dayOfWeek: number };

type TimeScorePerformance = ScorePerformance & { period: number };

export type ScorePatternsData = {
  strongestTime: TimeScorePerformance | null;
  strongestWeekday: WeekdayScorePerformance | null;
  times: TimeScorePerformance[];
  weekdays: WeekdayScorePerformance[];
};

type WeekdayScoreRow = {
  _sum: { correctAnswers: number | null; incorrectAnswers: number | null };
  dayOfWeek: number;
};

type TimeScoreRow = {
  correctAnswers: number | null;
  incorrectAnswers: number | null;
  period: number | null;
};

/**
 * Converts one weekday aggregate into the shared Score shape while retaining
 * its learner-local weekday key.
 */
function toWeekdayScorePerformance(row: WeekdayScoreRow): WeekdayScorePerformance | null {
  const performance = getScorePerformance({
    correctAnswers: row._sum.correctAnswers ?? 0,
    incorrectAnswers: row._sum.incorrectAnswers ?? 0,
  });

  return performance ? { ...performance, dayOfWeek: row.dayOfWeek } : null;
}

/**
 * Converts one time-of-day aggregate into the shared Score shape while keeping
 * the existing 0-to-3 period key used by Home and translations.
 */
function toTimeScorePerformance(row: TimeScoreRow): TimeScorePerformance | null {
  const performance = getScorePerformance({
    correctAnswers: row.correctAnswers ?? 0,
    incorrectAnswers: row.incorrectAnswers ?? 0,
  });

  return performance ? { ...performance, period: row.period ?? 0 } : null;
}

/**
 * Keeps only observed groups after nullable database aggregates have been
 * converted into Score performance rows.
 */
function getObservedPerformance<T>(rows: (T | null)[]): T[] {
  return rows.filter((row) => row !== null);
}

/**
 * Uses an explicit SQL predicate for the shared closed range because raw-query
 * interpolation cannot accept Prisma's object-shaped date filter.
 */
function getAnsweredAtRangeFilter({ endDate, startDate }: { endDate: Date; startDate: Date }): Sql {
  return sql`answered_at >= ${startDate} AND answered_at <= ${endDate}`;
}

/**
 * Loads weekday and time-of-day aggregates in parallel so the Patterns page
 * gets one coherent window without creating a database waterfall.
 */
async function findScorePatterns({
  dailyProgress,
  stepAttempts,
  userId,
}: ScoreDateRange & { userId: string }): Promise<ScorePatternsData | null> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const answeredAtRangeFilter = getAnsweredAtRangeFilter(stepAttempts);

  const [weekdayRows, timeRows] = await Promise.all([
    prisma.dailyProgress.groupBy({
      _sum: { correctAnswers: true, incorrectAnswers: true },
      by: ["dayOfWeek"],
      orderBy: { dayOfWeek: "asc" },
      where: { date: { gte: dailyProgress.startDate, lte: dailyProgress.endDate }, userId },
    }),
    prisma.$queryRaw<TimeScoreRow[]>`
      SELECT
        CASE
          WHEN hour_of_day BETWEEN 0 AND 5 THEN 0
          WHEN hour_of_day BETWEEN 6 AND 11 THEN 1
          WHEN hour_of_day BETWEEN 12 AND 17 THEN 2
          ELSE 3
        END AS "period",
        COUNT(*) FILTER (WHERE is_correct = true)::int AS "correctAnswers",
        COUNT(*) FILTER (WHERE is_correct = false)::int AS "incorrectAnswers"
      FROM step_attempts
      WHERE user_id = ${userId} AND ${answeredAtRangeFilter}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const weekdays = getObservedPerformance(weekdayRows.map((row) => toWeekdayScorePerformance(row)));

  const times = getObservedPerformance(timeRows.map((row) => toTimeScorePerformance(row)));

  if (weekdays.length === 0 && times.length === 0) {
    return null;
  }

  return {
    strongestTime: getStrongestScorePerformance(times),
    strongestWeekday: getStrongestScorePerformance(weekdays),
    times,
    weekdays,
  };
}

/**
 * Returns every observed performance pattern plus the strongest weekday and
 * time of day. Omitted dates use the same rolling 90-day window as Score.
 */
export async function getScorePatterns(
  params: ScoreRangeParams = {},
): Promise<ScorePatternsData | null> {
  const { data } = await safeAsync(async () => {
    const [dateRange, session] = await Promise.all([resolveScoreDateRange(params), getSession()]);

    if (!session) {
      return null;
    }

    return findScorePatterns({ ...dateRange, userId: session.user.id });
  });

  return data ?? null;
}
