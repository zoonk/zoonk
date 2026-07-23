import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type HistoryPeriod, formatPeriodLabel } from "@zoonk/utils/date-ranges";
import { formatMetricPercent } from "@zoonk/utils/number";
import { getFormatter, getLocale } from "next-intl/server";
import { MetricComparison } from "../_components/metric-comparison";
import {
  ProgressHeadline,
  ProgressHeadlineLabel,
  ProgressHeadlineRow,
  ProgressHeadlineValue,
} from "../_components/progress-headline";

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
    <ProgressHeadline>
      <ProgressHeadlineLabel>{periodLabel}</ProgressHeadlineLabel>

      <ProgressHeadlineRow>
        <ProgressHeadlineValue className="text-score">{formattedAverage}</ProgressHeadlineValue>

        {previousAverage !== null && (
          <MetricComparison current={average} period={period} previous={previousAverage} />
        )}
      </ProgressHeadlineRow>
    </ProgressHeadline>
  );
}

export function ScoreStatsSkeleton() {
  return (
    <ProgressHeadline>
      <Skeleton className="h-4 w-28" />
      <ProgressHeadlineRow>
        <Skeleton className="h-12 w-28" />
        <Skeleton className="h-5 w-32" />
      </ProgressHeadlineRow>
    </ProgressHeadline>
  );
}
