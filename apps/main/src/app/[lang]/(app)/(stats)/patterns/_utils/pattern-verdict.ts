import { MIN_PATTERN_ANSWERS, type ScorePerformance } from "@zoonk/core/progress/score-performance";

/** Under this many points between the best and the worst group that counts, none stands out. */
const EVEN_SPREAD_POINTS = 5;

/**
 * What the patterns can honestly say about one side of them (the week's days, the day's parts):
 * which group is the best, that the groups are about even (within `points` of each other), or
 * that fewer than two groups have enough answers to compare yet.
 */
export type PatternVerdict<Pattern> =
  | { best: Pattern; kind: "best" }
  | { kind: "even"; points: number }
  | { kind: "notEnough" };

/** The groups with enough answers to count (`MIN_PATTERN_ANSWERS`, the minimum core applies). */
export function getCountedPatterns<Pattern extends ScorePerformance>(
  patterns: readonly Pattern[],
): Pattern[] {
  return patterns.filter((pattern) => pattern.totalAnswers >= MIN_PATTERN_ANSWERS);
}

/**
 * Names a best group only when it stands out from others that count: a lone group has nothing to
 * be better than, and a lead of a few points is noise, not a pattern. `strongest` is core's, which
 * already leaves out groups with too few answers.
 */
export function getPatternVerdict<Pattern extends ScorePerformance>({
  patterns,
  strongest,
}: {
  patterns: readonly Pattern[];
  strongest: Pattern | null;
}): PatternVerdict<Pattern> {
  const counted = getCountedPatterns(patterns);

  if (!strongest || counted.length < 2) {
    return { kind: "notEnough" };
  }

  const scores = counted.map((pattern) => pattern.score);
  const spread = Math.max(...scores) - Math.min(...scores);

  if (spread < EVEN_SPREAD_POINTS) {
    return { kind: "even", points: Math.ceil(spread) };
  }

  return { best: strongest, kind: "best" };
}
