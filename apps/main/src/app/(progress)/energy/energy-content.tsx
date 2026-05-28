import { getEnergyHistory } from "@/data/progress/get-energy-history";
import { getSession } from "@zoonk/core/users/session/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { validatePeriod } from "@zoonk/utils/date-ranges";
import { getLocale } from "next-intl/server";
import { ProgressChartSkeleton } from "../_components/progress-chart-skeleton";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { EnergyChart } from "./energy-chart";
import { EnergyExplanation } from "./energy-explanation";
import { EnergyStats, EnergyStatsSkeleton } from "./energy-stats";

export async function EnergyContent({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;
  const validPeriod = validatePeriod(period);
  const locale = await getLocale();

  const [data, session] = await Promise.all([
    getEnergyHistory({ locale, offset: Number(offset), period: validPeriod }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <ProgressEmptyState isAuthenticated={isAuthenticated}>
        <EnergyExplanation />
      </ProgressEmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EnergyStats
        average={data.average}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        previousAverage={data.previousAverage}
      />

      <EnergyChart
        average={data.average}
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={validPeriod}
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
      <ProgressChartSkeleton />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
