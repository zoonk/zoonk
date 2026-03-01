import { getBpHistory } from "@/data/progress/get-bp-history";
import { getSession } from "@zoonk/core/users/session/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { validatePeriod } from "@zoonk/utils/date-ranges";
import { getLocale } from "next-intl/server";
import { PerformanceChartSkeleton } from "../_components/performance-chart-skeleton";
import { PerformanceEmptyState } from "../_components/performance-empty-state";
import { LevelChart } from "./level-chart";
import { LevelExplanation } from "./level-explanation";
import { LevelProgression, LevelProgressionSkeleton } from "./level-progression";
import { LevelStats, LevelStatsSkeleton } from "./level-stats";

export async function LevelContent({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;
  const validPeriod = validatePeriod(period);
  const locale = await getLocale();

  const [data, session] = await Promise.all([
    getBpHistory({
      locale,
      offset: Number(offset),
      period: validPeriod,
    }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <PerformanceEmptyState isAuthenticated={isAuthenticated}>
        <LevelExplanation />
      </PerformanceEmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <LevelStats
        currentBelt={data.currentBelt}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        periodTotal={data.periodTotal}
        previousPeriodTotal={data.previousPeriodTotal}
        totalBp={data.totalBp}
      />

      <LevelChart
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        periodTotal={data.periodTotal}
      />

      <LevelProgression currentBelt={data.currentBelt} />

      <LevelExplanation />
    </div>
  );
}

export function LevelContentSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <LevelStatsSkeleton />
      <PerformanceChartSkeleton />
      <LevelProgressionSkeleton />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
