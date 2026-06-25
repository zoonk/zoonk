import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type HistoryPeriod, formatPeriodLabel } from "@zoonk/utils/date-ranges";
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { MetricComparison } from "../_components/metric-comparison";

export async function EnergyStats({
  average,
  currentEnergy,
  period,
  periodEnd,
  periodStart,
  previousAverage,
}: {
  average: number;
  currentEnergy: number;
  period: HistoryPeriod;
  periodEnd: Date;
  periodStart: Date;
  previousAverage: number | null;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();

  const formattedAverage = formatMetricPercent({ format, value: average });
  const formattedCurrentEnergy = formatMetricPercent({ format, value: currentEnergy });
  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">{t("Current Energy")}</span>

        <span className="text-energy text-5xl font-bold tracking-tight tabular-nums">
          {formattedCurrentEnergy}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">{periodLabel}</span>

        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {t("{percentage} average", { percentage: formattedAverage })}
          </span>

          {previousAverage !== null && (
            <MetricComparison current={average} period={period} previous={previousAverage} />
          )}
        </div>
      </div>
    </div>
  );
}

export function EnergyStatsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-28" />
      </div>

      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-baseline gap-3">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </div>
  );
}
