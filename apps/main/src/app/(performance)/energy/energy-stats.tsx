import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { getExtracted, getLocale } from "next-intl/server";
import { MetricComparison } from "../_components/metric-comparison";
import { formatPeriodLabel } from "../_utils";

export async function EnergyStats({
  average,
  period,
  periodEnd,
  periodStart,
  previousAverage,
}: {
  average: number;
  period: HistoryPeriod;
  periodEnd: Date;
  periodStart: Date;
  previousAverage: number | null;
}) {
  const t = await getExtracted();
  const locale = await getLocale();

  const formattedAverage = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    trailingZeroDisplay: "stripIfInteger",
  }).format(average);

  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{periodLabel}</span>

      <div className="flex items-baseline gap-3">
        <span className="text-energy text-5xl font-bold tracking-tight tabular-nums">
          {t("{value}%", { value: formattedAverage })}
        </span>

        {previousAverage !== null && (
          <MetricComparison current={average} period={period} previous={previousAverage} />
        )}
      </div>
    </div>
  );
}

export function EnergyStatsSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-baseline gap-3">
        <Skeleton className="h-12 w-28" />
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
  );
}
