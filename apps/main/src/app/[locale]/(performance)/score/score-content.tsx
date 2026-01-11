import { getSession } from "@zoonk/core/users/session/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import type { ScorePeriod } from "@/data/progress/get-score-history";
import { getScoreHistory } from "@/data/progress/get-score-history";
import { PerformanceChartSkeleton } from "../_components/performance-chart-skeleton";
import { PerformanceEmptyState } from "../_components/performance-empty-state";
import { ScoreChart } from "./score-chart";
import { ScoreExplanation } from "./score-explanation";
import { ScoreInsights, ScoreInsightsSkeleton } from "./score-insights";
import { ScoreStats, ScoreStatsSkeleton } from "./score-stats";

export async function ScoreContent({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;

  const [data, session] = await Promise.all([
    getScoreHistory({
      locale,
      offset: Number(offset),
      period: period as ScorePeriod,
    }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <PerformanceEmptyState isAuthenticated={isAuthenticated}>
        <ScoreExplanation />
      </PerformanceEmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ScoreStats
        average={data.average}
        period={period as ScorePeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        previousAverage={data.previousAverage}
      />

      <ScoreChart
        average={data.average}
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={period as ScorePeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
      />

      <ScoreInsights
        period={period as ScorePeriod}
        periodStart={data.periodStart}
      />

      <ScoreExplanation />
    </div>
  );
}

export function ScoreContentSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <ScoreStatsSkeleton />
      <PerformanceChartSkeleton />
      <ScoreInsightsSkeleton />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
