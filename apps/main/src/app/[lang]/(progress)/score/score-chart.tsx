import { type ScorePerformance } from "@/data/progress/_utils/score-performance";
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

/**
 * Reserves the weekly chart caption and plot height without carrying over the
 * removed period buttons or navigation controls.
 */
export function ScoreChartSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
