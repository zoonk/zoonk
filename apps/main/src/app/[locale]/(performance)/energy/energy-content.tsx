import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import type { EnergyPeriod } from "@/data/progress/get-energy-history";
import { getEnergyHistory } from "@/data/progress/get-energy-history";
import { EnergyChart, EnergyChartSkeleton } from "./energy-chart";
import { EnergyExplanation } from "./energy-explanation";
import { EnergyStats, EnergyStatsSkeleton } from "./energy-stats";

type EnergyContentProps = {
  locale: string;
  searchParams: Promise<{ offset?: string; period?: string }>;
};

export async function EnergyContent({
  locale,
  searchParams,
}: EnergyContentProps) {
  const { offset = "0", period = "month" } = await searchParams;
  const t = await getExtracted();
  const data = await getEnergyHistory({
    locale,
    offset: Number(offset),
    period: period as EnergyPeriod,
  });

  if (!data) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          {t("Start learning to track your energy level")}
        </div>

        <EnergyExplanation />
      </div>
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
      <EnergyChartSkeleton />

      {/* Explanation skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
