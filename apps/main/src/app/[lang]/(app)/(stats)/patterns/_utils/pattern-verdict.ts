import { MIN_PATTERN_ANSWERS, type ScorePerformance } from "@zoonk/core/progress/score-performance";

const EVEN_SPREAD_POINTS = 5;

export type PatternVerdict<Pattern> =
  | { best: Pattern; kind: "best" }
  | { kind: "even"; points: number }
  | { kind: "notEnough" };

export function getCountedPatterns<Pattern extends ScorePerformance>(
  patterns: readonly Pattern[],
): Pattern[] {
  return patterns.filter((pattern) => pattern.totalAnswers >= MIN_PATTERN_ANSWERS);
}

/** A lone group has nothing to be better than, and a lead of a few points is noise, not a pattern. */
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
