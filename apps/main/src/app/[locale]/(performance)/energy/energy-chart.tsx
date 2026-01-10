import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted, getLocale } from "next-intl/server";
import type {
  EnergyDataPoint,
  EnergyPeriod,
} from "@/data/progress/get-energy-history";
import { PeriodNavigation } from "../_components/period-navigation";
import { PeriodTabs } from "../_components/period-tabs";
import { EnergyChartClient } from "./energy-chart-client";

function formatPeriodLabel(
  periodStart: Date,
  periodEnd: Date,
  period: EnergyPeriod,
  locale: string,
): string {
  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(periodStart);
  }

  if (period === "6months") {
    const startMonth = new Intl.DateTimeFormat(locale, {
      month: "short",
    }).format(periodStart);

    const endMonth = new Intl.DateTimeFormat(locale, { month: "short" }).format(
      periodEnd,
    );

    const year = periodStart.getFullYear();

    return `${startMonth} - ${endMonth} ${year}`;
  }

  return String(periodStart.getFullYear());
}

export async function EnergyChart({
  average,
  dataPoints,
  hasNext,
  hasPrevious,
  period,
  periodEnd,
  periodStart,
}: {
  average: number;
  dataPoints: EnergyDataPoint[];
  hasNext: boolean;
  hasPrevious: boolean;
  period: EnergyPeriod;
  periodEnd: Date;
  periodStart: Date;
}) {
  const t = await getExtracted();
  const locale = await getLocale();

  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  const serializedDataPoints = dataPoints.map((point) => ({
    date: point.date.toISOString(),
    energy: point.energy,
    label: point.label,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodTabs />

        <PeriodNavigation
          hasNext={hasNext}
          hasPrevious={hasPrevious}
          periodLabel={periodLabel}
        />
      </div>

      {dataPoints.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          {t("No data available for this period")}
        </div>
      ) : (
        <EnergyChartClient
          average={average}
          dataPoints={serializedDataPoints}
        />
      )}
    </div>
  );
}

export function EnergyChartSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-14 rounded-lg" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>

      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
