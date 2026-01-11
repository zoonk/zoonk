import { getSession } from "@zoonk/core/users/session/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import type { HistoryPeriod } from "@/data/progress/_utils";
import { getBpHistory } from "@/data/progress/get-bp-history";
import { PerformanceChartSkeleton } from "../_components/performance-chart-skeleton";
import { PerformanceEmptyState } from "../_components/performance-empty-state";
import { BeltChart } from "./belt-chart";
import { BeltExplanation } from "./belt-explanation";
import { BeltProgression, BeltProgressionSkeleton } from "./belt-progression";
import { BeltStats, BeltStatsSkeleton } from "./belt-stats";

export async function BeltContent({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;

  const [data, session] = await Promise.all([
    getBpHistory({
      locale,
      offset: Number(offset),
      period: period as HistoryPeriod,
    }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <PerformanceEmptyState isAuthenticated={isAuthenticated}>
        <BeltExplanation />
      </PerformanceEmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <BeltStats
        currentBelt={data.currentBelt}
        period={period as HistoryPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        periodTotal={data.periodTotal}
        previousPeriodTotal={data.previousPeriodTotal}
        totalBp={data.totalBp}
      />

      <BeltChart
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={period as HistoryPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        periodTotal={data.periodTotal}
      />

      <BeltProgression currentBelt={data.currentBelt} />

      <BeltExplanation />
    </div>
  );
}

export function BeltContentSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <BeltStatsSkeleton />
      <PerformanceChartSkeleton />
      <BeltProgressionSkeleton />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
