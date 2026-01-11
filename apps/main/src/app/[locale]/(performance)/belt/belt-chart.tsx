import { getLocale } from "next-intl/server";
import type { HistoryPeriod } from "@/data/progress/_utils";
import type { BpDataPoint } from "@/data/progress/get-bp-history";
import { PerformanceChartLayout } from "../_components/performance-chart-layout";
import { formatPeriodLabel } from "../_utils";
import { BeltChartClient } from "./belt-chart-client";

type SerializedDataPoint = {
  date: string;
  bp: number;
  label: string;
};

export async function BeltChart({
  dataPoints,
  hasNext,
  hasPrevious,
  period,
  periodEnd,
  periodStart,
  periodTotal,
}: {
  dataPoints: BpDataPoint[];
  hasNext: boolean;
  hasPrevious: boolean;
  period: HistoryPeriod;
  periodEnd: Date;
  periodStart: Date;
  periodTotal: number;
}) {
  const locale = await getLocale();
  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  const serializedDataPoints: SerializedDataPoint[] = dataPoints.map(
    (point) => ({
      bp: point.bp,
      date: point.date.toISOString(),
      label: point.label,
    }),
  );

  return (
    <PerformanceChartLayout
      hasNext={hasNext}
      hasPrevious={hasPrevious}
      isEmpty={dataPoints.length === 0}
      periodLabel={periodLabel}
    >
      <BeltChartClient dataPoints={serializedDataPoints} total={periodTotal} />
    </PerformanceChartLayout>
  );
}
