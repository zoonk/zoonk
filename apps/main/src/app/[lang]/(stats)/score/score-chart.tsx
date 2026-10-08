import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ScoreChartClient } from "./score-chart-client";

type ScoreTrendDataPoint = ScorePerformance & { date: Date; label: string };

/**
 * Serializes the fixed weekly Score trend at the server boundary so the client
 * chart receives only the small, JSON-safe dataset it needs.
 */
export function ScoreChart({
  dataPoints,
  performance,
}: {
  dataPoints: ScoreTrendDataPoint[];
  performance: ScorePerformance;
}) {
  const serializedDataPoints = dataPoints.map((point) => ({
    correctAnswers: point.correctAnswers,
    date: point.date.toISOString(),
    incorrectAnswers: point.incorrectAnswers,
    label: point.label,
    score: point.score,
    totalAnswers: point.totalAnswers,
  }));

  return <ScoreChartClient dataPoints={serializedDataPoints} performance={performance} />;
}

/** Reserves the weekly chart's plot height while the rolling data streams. */
export function ScoreChartSkeleton() {
  return <Skeleton aria-hidden="true" className="h-64 w-full rounded-xl" />;
}
