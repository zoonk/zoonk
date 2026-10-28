import "server-only";
import { type DailyProgress, prisma } from "@zoonk/db";
import {
  type ProgressHistoryOptions,
  dailyProgressInWindow,
  readLifetimeDailyProgress,
} from "./_utils/daily-progress-rows";
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

type HourScoreRow = {
  _sum: { correctAnswers: number | null; incorrectAnswers: number | null };
  hour: number;
};

type AnswerTotals = { correctAnswers: number; incorrectAnswers: number };

const WEEKDAY_COUNT = 7;
const TIME_PERIOD_COUNT = 4;
const HOURS_PER_TIME_PERIOD = 6;

const EMPTY_SCORE_PERFORMANCE: ScorePerformance = {
  correctAnswers: 0,
  incorrectAnswers: 0,
  score: 0,
  totalAnswers: 0,
};

function toWeekdayScorePerformance(row: WeekdayScoreRow): WeekdayScorePattern | null {
  const performance = getScorePerformance({
    correctAnswers: row._sum.correctAnswers ?? 0,
    incorrectAnswers: row._sum.incorrectAnswers ?? 0,
  });

  return performance ? { ...performance, dayOfWeek: row.dayOfWeek } : null;
}

function getPeriodAnswerTotals({
  period,
  rows,
}: {
  period: number;
  rows: HourScoreRow[];
}): AnswerTotals {
  const periodRows = rows.filter((row) => Math.floor(row.hour / HOURS_PER_TIME_PERIOD) === period);

  return {
    correctAnswers: periodRows.reduce((total, row) => total + (row._sum.correctAnswers ?? 0), 0),
    incorrectAnswers: periodRows.reduce(
      (total, row) => total + (row._sum.incorrectAnswers ?? 0),
      0,
    ),
  };
}

function toTimeScorePattern({
  period,
  rows,
}: {
  period: number;
  rows: HourScoreRow[];
}): TimeScorePattern | null {
  const performance = getScorePerformance(getPeriodAnswerTotals({ period, rows }));

  return performance ? { ...performance, period } : null;
}

function getTimeScorePatterns(rows: HourScoreRow[]): TimeScorePattern[] {
  return getObservedPerformance(
    Array.from({ length: TIME_PERIOD_COUNT }, (_, period) => toTimeScorePattern({ period, rows })),
  );
}

function getObservedPerformance<T>(rows: (T | null)[]): T[] {
  return rows.filter((row) => row !== null);
}

function weekdayDailyTotals({
  dayOfWeek,
  rows,
}: {
  dayOfWeek: number;
  rows: DailyProgress[];
}): WeekdayScoreRow {
  const days = rows.filter((row) => row.dayOfWeek === dayOfWeek);

  return {
    _sum: {
      correctAnswers: days.reduce((sum, row) => sum + row.correctAnswers, 0),
      incorrectAnswers: days.reduce((sum, row) => sum + row.incorrectAnswers, 0),
    },
    dayOfWeek,
  };
}

async function readWeekdayTotals({
  endDate,
  startDate,
  userId,
  history,
}: ScoreDateRange & ProgressHistoryOptions & { userId: string }): Promise<WeekdayScoreRow[]> {
  if (history === "lifetime") {
    const rows = dailyProgressInWindow({
      endDate,
      rows: await readLifetimeDailyProgress(userId),
      startDate,
    });

    return Array.from({ length: WEEKDAY_COUNT }, (_, dayOfWeek) =>
      weekdayDailyTotals({ dayOfWeek, rows }),
    );
  }

  const rows = await prisma.dailyProgress.groupBy({
    _sum: { correctAnswers: true, incorrectAnswers: true },
    by: ["dayOfWeek"],
    orderBy: { dayOfWeek: "asc" },
    where: { date: { gte: startDate, lte: endDate }, userId },
  });

  return rows;
}

/** Exclude session aggregate rows because their lesson/block answers are already counted separately. */
async function queryScorePatterns({
  endDate,
  startDate,
  userId,
  history,
}: ScoreDateRange &
  ProgressHistoryOptions & { userId: string }): Promise<ScorePatternsData | null> {
  const [weekdayRows, hourRows] = await Promise.all([
    readWeekdayTotals({ endDate, history, startDate, userId }),
    prisma.learningEvent.groupBy({
      _sum: { correctAnswers: true, incorrectAnswers: true },
      by: ["hour"],
      orderBy: { hour: "asc" },
      where: { kind: { not: "session" }, localDate: { gte: startDate, lte: endDate }, userId },
    }),
  ]);

  const weekdays = getObservedPerformance(weekdayRows.map((row) => toWeekdayScorePerformance(row)));

  const times = getTimeScorePatterns(hourRows);

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

/** Returns only observed groups in the current 90-day window. */
export async function getScorePatterns({
  history,
}: ProgressHistoryOptions = {}): Promise<ScorePatternsData | null> {
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

  return queryScorePatterns({ ...dateRange, history, userId: session.user.id });
}

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

/** Missing categories have zero answer counts, which is not a measured zero-percent score. */
function completeScorePatterns(patterns: ScorePatternsData): ScorePatternsData {
  const weekdays = Array.from({ length: WEEKDAY_COUNT }, (_, dayOfWeek) =>
    getCompleteWeekdayPattern({ dayOfWeek, patterns: patterns.weekdays }),
  );

  const times = Array.from({ length: TIME_PERIOD_COUNT }, (_, period) =>
    getCompleteTimePattern({ patterns: patterns.times, period }),
  );

  return { ...patterns, times, weekdays };
}

/** Outer null means unauthenticated; patterns=null means no observed answers. */
export async function getCurrentUserScorePatterns({
  history,
}: ProgressHistoryOptions = {}): Promise<{ patterns: ScorePatternsData | null } | null> {
  "use cache: private";

  const [session, patterns] = await Promise.all([
    getProgressSession(),
    history ? getScorePatterns({ history }) : getScorePatterns(),
  ]);

  if (!session) {
    return null;
  }

  return { patterns: patterns ? completeScorePatterns(patterns) : null };
}
