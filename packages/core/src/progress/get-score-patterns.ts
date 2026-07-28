import "server-only";
import { type Sql, prisma, sql } from "@zoonk/db";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { type ScoreDateRange, getScoreDateRange } from "./score-date-range";
import {
  type ScorePerformance,
  getScorePerformance,
  getStrongestScorePerformance,
} from "./score-performance";

export type WeekdayScorePattern = ScorePerformance & { dayOfWeek: number };

export type TimeScorePattern = ScorePerformance & { period: number };

export type ScorePatternsData = {
  strongestTime: TimeScorePattern | null;
  strongestWeekday: WeekdayScorePattern | null;
  times: TimeScorePattern[];
  weekdays: WeekdayScorePattern[];
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

const WEEKDAY_COUNT = 7;
const TIME_PERIOD_COUNT = 4;

const EMPTY_SCORE_PERFORMANCE: ScorePerformance = {
  correctAnswers: 0,
  incorrectAnswers: 0,
  score: 0,
  totalAnswers: 0,
};

/**
 * Converts one weekday aggregate into the shared Score shape while retaining
 * its learner-local weekday key.
 */
function toWeekdayScorePerformance(row: WeekdayScoreRow): WeekdayScorePattern | null {
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
function toTimeScorePerformance(row: TimeScoreRow): TimeScorePattern | null {
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
async function queryScorePatterns({
  dailyProgress,
  stepAttempts,
  userId,
}: ScoreDateRange & { userId: string }): Promise<ScorePatternsData | null> {
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
 * time of day for the current learner's 90-day Score window.
 */
export async function getScorePatterns(): Promise<ScorePatternsData | null> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return null;
  }

  const dateRange: ScoreDateRange = getScoreDateRange({
    now: dateContext.currentInstant,
    timeZone: dateContext.timeZone,
  });

  return queryScorePatterns({ ...dateRange, userId: session.user.id });
}

/**
 * Preserves an observed weekday or returns a zero-answer placeholder so every
 * consumer receives the same stable Sunday-through-Saturday sequence.
 */
function getCompleteWeekdayPattern({
  dayOfWeek,
  patterns,
}: {
  dayOfWeek: number;
  patterns: WeekdayScorePattern[];
}): WeekdayScorePattern {
  return (
    patterns.find((pattern) => pattern.dayOfWeek === dayOfWeek) ?? {
      ...EMPTY_SCORE_PERFORMANCE,
      dayOfWeek,
    }
  );
}

/**
 * Preserves an observed daypart or returns a zero-answer placeholder so every
 * consumer receives the same stable night-through-evening sequence.
 */
function getCompleteTimePattern({
  patterns,
  period,
}: {
  patterns: TimeScorePattern[];
  period: number;
}): TimeScorePattern {
  return (
    patterns.find((pattern) => pattern.period === period) ?? { ...EMPTY_SCORE_PERFORMANCE, period }
  );
}

/**
 * Adds every weekday and daypart to the observed Score patterns so API clients
 * receive one stable contract and do not each need to recreate missing rows.
 * Zero answer counts make it explicit that an absent category is not a measured
 * zero-percent score.
 */
function completeScorePatterns(patterns: ScorePatternsData): ScorePatternsData {
  const weekdays = Array.from({ length: WEEKDAY_COUNT }, (_, dayOfWeek) =>
    getCompleteWeekdayPattern({ dayOfWeek, patterns: patterns.weekdays }),
  );

  const times = Array.from({ length: TIME_PERIOD_COUNT }, (_, period) =>
    getCompleteTimePattern({ patterns: patterns.times, period }),
  );

  return { ...patterns, times, weekdays };
}

/**
 * Returns a complete current-user Score-pattern resource while distinguishing
 * missing authentication from an authenticated learner with no observed
 * answers in the rolling window.
 */
export async function getCurrentUserScorePatterns(): Promise<{
  patterns: ScorePatternsData | null;
} | null> {
  "use cache: private";

  const [session, patterns] = await Promise.all([getProgressSession(), getScorePatterns()]);

  if (!session) {
    return null;
  }

  return { patterns: patterns ? completeScorePatterns(patterns) : null };
}
