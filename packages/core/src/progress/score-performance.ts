const DAYS_FROM_SUNDAY_TO_PREVIOUS_MONDAY = 6;

export type AnswerCounts = { correctAnswers: number; incorrectAnswers: number };

export type ScorePerformance = AnswerCounts & { score: number; totalAnswers: number };

export type DatedAnswerCounts = AnswerCounts & { date: Date };

export type DatedScorePerformance = ScorePerformance & { date: Date };

type ScoreWeek = { date: Date; rows: readonly AnswerCounts[] };

/**
 * Converts answer totals into the canonical weighted Score shape shared by the
 * headline, weekly trend, weekday patterns, and time-of-day patterns.
 */
export function getScorePerformance({
  correctAnswers,
  incorrectAnswers,
}: AnswerCounts): ScorePerformance | null {
  const totalAnswers = correctAnswers + incorrectAnswers;

  if (totalAnswers === 0) {
    return null;
  }

  return {
    correctAnswers,
    incorrectAnswers,
    score: (correctAnswers / totalAnswers) * 100,
    totalAnswers,
  };
}

/**
 * Adds one answer-count row without mutating the running total so callers can
 * combine database buckets with a small, named reduction rule.
 */
function addAnswerCounts(total: AnswerCounts, row: AnswerCounts): AnswerCounts {
  return {
    correctAnswers: total.correctAnswers + row.correctAnswers,
    incorrectAnswers: total.incorrectAnswers + row.incorrectAnswers,
  };
}

/**
 * Combines answer-count rows before calculating Score so high- and low-volume
 * rows contribute in proportion to the questions the learner answered.
 */
export function getCombinedScorePerformance(
  rows: readonly AnswerCounts[],
): ScorePerformance | null {
  const totals = rows.reduce((total, row) => addAnswerCounts(total, row), {
    correctAnswers: 0,
    incorrectAnswers: 0,
  });

  return getScorePerformance(totals);
}

/**
 * Picks the strongest observed group by accuracy first and answer volume
 * second. No sample threshold is hidden here because the UI presents the count
 * beside every percentage.
 */
export function getStrongestScorePerformance<T extends ScorePerformance>(
  rows: readonly T[],
): T | null {
  return (
    rows.toSorted(
      (first, second) => second.score - first.score || second.totalAnswers - first.totalAnswers,
    )[0] ?? null
  );
}

/**
 * Normalizes any date in a stored Score row to the UTC Monday that identifies
 * its weekly trend bucket.
 */
function getMondayOfWeek(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? DAYS_FROM_SUNDAY_TO_PREVIOUS_MONDAY : dayOfWeek - 1;

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday),
  );
}

/**
 * Groups date-only answer rows without changing their counts so each weekly
 * Score can be calculated from combined answers rather than averaged daily
 * percentages.
 */
function groupScoreRowsByWeek(rows: readonly DatedAnswerCounts[]): ScoreWeek[] {
  const weeks = new Map<string, ScoreWeek>();

  for (const row of rows) {
    const date = getMondayOfWeek(row.date);
    const key = date.toISOString();
    const existingRows = weeks.get(key)?.rows ?? [];

    weeks.set(key, { date, rows: [...existingRows, row] });
  }

  return [...weeks.values()].toSorted(
    (first, second) => first.date.getTime() - second.date.getTime(),
  );
}

/**
 * Converts one non-empty weekly group into the complete Score shape consumed by
 * the trend chart. Stored zero-answer rows are discarded before grouping.
 */
function getWeeklyPerformance({ date, rows }: ScoreWeek): DatedScorePerformance | null {
  const performance = getCombinedScorePerformance(rows);
  return performance ? { ...performance, date } : null;
}

/**
 * Builds a Monday-based weighted weekly trend while omitting stored progress
 * rows that contain no answered questions.
 */
export function getWeeklyScorePerformance(
  rows: readonly DatedAnswerCounts[],
): DatedScorePerformance[] {
  return groupScoreRowsByWeek(rows.filter((row) => row.correctAnswers + row.incorrectAnswers > 0))
    .map((week) => getWeeklyPerformance(week))
    .filter((performance) => performance !== null);
}
