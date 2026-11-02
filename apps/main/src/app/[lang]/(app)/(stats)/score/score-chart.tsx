import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { OnDemandScoreChartPlot } from "./on-demand-score-chart-plot";
import { ScoreChartFigure } from "./score-chart-figure";

type ScoreTrendDataPoint = ScorePerformance & { date: Date; label: string };

export type SerializedScoreDataPoint = ScorePerformance & { date: string; label: string };

export function ScoreChart({
  dataPoints,
  media,
  performance,
}: {
  dataPoints: ScoreTrendDataPoint[];
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

export function ScoreChartSkeleton() {
  return <Skeleton aria-hidden="true" className="h-55 w-full rounded-lg" />;
}
