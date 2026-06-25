import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type HistoryPeriod, formatPeriodLabel } from "@zoonk/utils/date-ranges";
import { formatMetricPercent } from "@zoonk/utils/number";
import { getFormatter, getLocale } from "next-intl/server";
import { MetricComparison } from "../_components/metric-comparison";

export async function ScoreStats({
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
  const format = await getFormatter();
  const locale = await getLocale();

  const formattedAverage = formatMetricPercent({ format, value: average });
  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{periodLabel}</span>

      <div className="flex items-baseline gap-3">
        <span className="text-score text-5xl font-bold tracking-tight tabular-nums">
          {formattedAverage}
        </span>

        {previousAverage !== null && (
          <MetricComparison current={average} period={period} previous={previousAverage} />
        )}
      </div>
    </div>
  );
}

export function ScoreStatsSkeleton() {
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
