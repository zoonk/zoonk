import { type ScorePerformance } from "@/data/progress/_utils/score-performance";

export type WeekdayScorePattern = ScorePerformance & { dayOfWeek: number };
export type TimeScorePattern = ScorePerformance & { period: number };

const WEEKDAY_COUNT = 7;
const TIME_PERIOD_COUNT = 4;
const WEEKDAY_INDICES = Array.from({ length: WEEKDAY_COUNT }, (_, dayOfWeek) => dayOfWeek);
const TIME_PERIOD_INDICES = Array.from({ length: TIME_PERIOD_COUNT }, (_, period) => period);

const EMPTY_SCORE_PERFORMANCE: ScorePerformance = {
  correctAnswers: 0,
  incorrectAnswers: 0,
  score: 0,
  totalAnswers: 0,
};

/**
 * Builds a zero-answer weekday row when the learner has not answered anything
 * on that weekday during the fixed window. The breakdown can then keep a stable
 * seven-day shape without presenting missing activity as a measured 0% score.
 */
function getWeekdayPattern({
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
 * Builds a zero-answer time row when the learner has no attempts in that
 * daypart. Rendering all four periods makes the clock ranges understandable
 * while the zero answer count prevents the UI from inventing a score.
 */
function getTimePattern({
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
 * Returns every weekday in calendar order while preserving the measured
 * performance returned by the data layer for observed weekdays.
 */
export function getCompleteWeekdayPatterns(patterns: WeekdayScorePattern[]): WeekdayScorePattern[] {
  return WEEKDAY_INDICES.map((dayOfWeek) => getWeekdayPattern({ dayOfWeek, patterns }));
}

/**
 * Returns Night, Morning, Afternoon, and Evening in their fixed product order
 * while preserving measured performance for observed dayparts.
 */
export function getCompleteTimePatterns(patterns: TimeScorePattern[]): TimeScorePattern[] {
  return TIME_PERIOD_INDICES.map((period) => getTimePattern({ patterns, period }));
}
