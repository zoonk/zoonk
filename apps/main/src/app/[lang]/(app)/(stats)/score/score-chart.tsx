import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { OnDemandScoreChartPlot } from "./on-demand-score-chart-plot";
import { ScoreChartFigure } from "./score-chart-figure";

type ScoreTrendDataPoint = ScorePerformance & { date: Date; label: string };

export type SerializedScoreDataPoint = ScorePerformance & { date: string; label: string };

/**
 * Serializes the fixed weekly Score trend at the server boundary so the client
 * chart receives only the small, JSON-safe dataset it needs. Score shows its plot at every width,
 * the overview only where it shows its trend (`media`).
 */
export function ScoreChart({
  dataPoints,
  media,
  performance,
}: {
  dataPoints: ScoreTrendDataPoint[];
  /** Where the page shows the plot; elsewhere its code never loads. Every width without one. */
  media?: string;
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

  return (
    <ScoreChartFigure dataPoints={serializedDataPoints} performance={performance}>
      <OnDemandScoreChartPlot dataPoints={serializedDataPoints} media={media} />
    </ScoreChartFigure>
  );
}

/** Reserves the weekly chart's plot height while the rolling data streams. */
export function ScoreChartSkeleton() {
  return <Skeleton aria-hidden="true" className="h-55 w-full rounded-lg" />;
}
