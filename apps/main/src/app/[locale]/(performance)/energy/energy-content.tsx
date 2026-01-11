import { getSession } from "@zoonk/core/users/session/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import type { EnergyPeriod } from "@/data/progress/get-energy-history";
import { getEnergyHistory } from "@/data/progress/get-energy-history";
import { PerformanceChartSkeleton } from "../_components/performance-chart-skeleton";
import { PerformanceEmptyState } from "../_components/performance-empty-state";
import { EnergyChart } from "./energy-chart";
import { EnergyExplanation } from "./energy-explanation";
import { EnergyStats, EnergyStatsSkeleton } from "./energy-stats";

export async function EnergyContent({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;

  const [data, session] = await Promise.all([
    getEnergyHistory({
      locale,
      offset: Number(offset),
      period: period as EnergyPeriod,
    }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <PerformanceEmptyState isAuthenticated={isAuthenticated}>
        <EnergyExplanation />
      </PerformanceEmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EnergyStats
        average={data.average}
        period={period as EnergyPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        previousAverage={data.previousAverage}
      />

      <EnergyChart
        average={data.average}
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={period as EnergyPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
      />

      <EnergyExplanation />
    </div>
  );
}

export function EnergyContentSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <EnergyStatsSkeleton />
      <PerformanceChartSkeleton />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
