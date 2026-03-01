import { type BpDataPoint } from "@/data/progress/get-bp-history";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";
import { getLocale } from "next-intl/server";
import { PerformanceChartLayout } from "../_components/performance-chart-layout";
import { formatPeriodLabel } from "../_utils";
import { LevelChartClient } from "./level-chart-client";

export async function LevelChart({
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

  const serializedDataPoints: {
    date: string;
    bp: number;
    label: string;
  }[] = dataPoints.map((point) => ({
    bp: point.bp,
    date: point.date.toISOString(),
    label: point.label,
  }));

  return (
    <PerformanceChartLayout
      hasNext={hasNext}
      hasPrevious={hasPrevious}
      isEmpty={dataPoints.length === 0}
      periodLabel={periodLabel}
    >
      <LevelChartClient dataPoints={serializedDataPoints} total={periodTotal} />
    </PerformanceChartLayout>
  );
}
