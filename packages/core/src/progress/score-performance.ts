const DAYS_FROM_SUNDAY_TO_PREVIOUS_MONDAY = 6;

export type AnswerCounts = { correctAnswers: number; incorrectAnswers: number };

export type ScorePerformance = AnswerCounts & { score: number; totalAnswers: number };

export type DatedAnswerCounts = AnswerCounts & { date: Date };

export type DatedScorePerformance = ScorePerformance & { date: Date };

type ScoreWeek = { date: Date; rows: readonly AnswerCounts[] };

/** Returns null for zero total answers. */
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

function addAnswerCounts(total: AnswerCounts, row: AnswerCounts): AnswerCounts {
  return {
    correctAnswers: total.correctAnswers + row.correctAnswers,
    incorrectAnswers: total.incorrectAnswers + row.incorrectAnswers,
  };
}

/** Weight by answer counts, never average per-row percentages. */
export function getCombinedScorePerformance(
  rows: readonly AnswerCounts[],
): ScorePerformance | null {
  const totals = rows.reduce((total, row) => addAnswerCounts(total, row), {
    correctAnswers: 0,
    incorrectAnswers: 0,
  });

  return getScorePerformance(totals);
}

/** Require enough observations so a single lucky answer cannot become a named pattern. */
export const MIN_PATTERN_ANSWERS = 10;

const EVEN_SPREAD_POINTS = 5;

export type PatternVerdict<Pattern> =
  | { best: Pattern; kind: "best" }
  | { kind: "even"; points: number }
  | { kind: "notEnough" };

export type ScoreSpread = { high: number; low: number };

/** Null under two groups with enough answers to count. */
export function getScoreSpread(rows: readonly ScorePerformance[]): ScoreSpread | null {
  const scores = rows
    .filter((row) => row.totalAnswers >= MIN_PATTERN_ANSWERS)
    .map((row) => row.score);

  return scores.length < 2 ? null : { high: Math.max(...scores), low: Math.min(...scores) };
}

/** A lone group has nothing to be better than, and a lead of a few points is noise, not a pattern. */
export function getPatternVerdict<Pattern extends ScorePerformance>({
  patterns,
  strongest,
}: {
  patterns: readonly Pattern[];
  strongest: Pattern | null;
}): PatternVerdict<Pattern> {
  const spread = getScoreSpread(patterns);

  if (!strongest || !spread) {
    return { kind: "notEnough" };
  }

  const points = spread.high - spread.low;

  return points < EVEN_SPREAD_POINTS
    ? { kind: "even", points: Math.ceil(points) }
    : { best: strongest, kind: "best" };
}

/** Null without enough answers; accuracy ranks first, answer volume breaks ties. */
export function getStrongestScorePerformance<T extends ScorePerformance>(
  rows: readonly T[],
): T | null {
  return (
    rows
      .filter((row) => row.totalAnswers >= MIN_PATTERN_ANSWERS)
      .toSorted(
        (first, second) => second.score - first.score || second.totalAnswers - first.totalAnswers,
      )[0] ?? null
  );
}

function getMondayOfWeek(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? DAYS_FROM_SUNDAY_TO_PREVIOUS_MONDAY : dayOfWeek - 1;

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday),
  );
}

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

function getWeeklyPerformance({ date, rows }: ScoreWeek): DatedScorePerformance | null {
  const performance = getCombinedScorePerformance(rows);
  return performance ? { ...performance, date } : null;
}

/** Omits dates with no answers; week keys are UTC-midnight Monday labels. */
export function getWeeklyScorePerformance(
  rows: readonly DatedAnswerCounts[],
): DatedScorePerformance[] {
  return groupScoreRowsByWeek(rows.filter((row) => row.correctAnswers + row.incorrectAnswers > 0))
    .map((week) => getWeeklyPerformance(week))
    .filter((performance) => performance !== null);
}
