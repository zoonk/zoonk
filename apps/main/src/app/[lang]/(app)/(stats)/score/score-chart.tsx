import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type ComponentType } from "react";
import { ScoreChartFigure } from "./score-chart-figure";

type ScoreTrendDataPoint = ScorePerformance & { date: Date; label: string };

export type SerializedScoreDataPoint = ScorePerformance & { date: string; label: string };

/**
 * Serializes the fixed weekly Score trend at the server boundary so the client
 * chart receives only the small, JSON-safe dataset it needs. The page picks its plot: Score draws
 * it with the page, the overview only where it shows it (`WideScoreChartPlot`).
 */
export function ScoreChart({
  dataPoints,
  performance,
  plot: Plot,
}: {
  dataPoints: ScoreTrendDataPoint[];
  performance: ScorePerformance;
  plot: ComponentType<{ dataPoints: SerializedScoreDataPoint[] }>;
}) {
  const serializedDataPoints = dataPoints.map((point) => ({
    correctAnswers: point.correctAnswers,
    date: point.date.toISOString(),
    incorrectAnswers: point.incorrectAnswers,
    label: point.label,
    score: point.score,
    totalAnswers: point.totalAnswers,
  }));

  return (
    <ScoreChartFigure dataPoints={serializedDataPoints} performance={performance}>
      <Plot dataPoints={serializedDataPoints} />
    </ScoreChartFigure>
  );
}

/** Reserves the weekly chart's plot height while the rolling data streams. */
export function ScoreChartSkeleton() {
  return <Skeleton aria-hidden="true" className="h-55 w-full rounded-lg" />;
}
