import { getLocale } from "next-intl/server";
import { PerformanceChartLayout } from "../_components/performance-chart-layout";
import { formatPeriodLabel } from "../_utils";
import { ScoreChartClient } from "./score-chart-client";
import type { ScoreDataPoint, ScorePeriod } from "@/data/progress/get-score-history";

export async function ScoreChart({
  average,
  dataPoints,
  hasNext,
  hasPrevious,
  period,
  periodEnd,
  periodStart,
}: {
  average: number;
  dataPoints: ScoreDataPoint[];
  hasNext: boolean;
  hasPrevious: boolean;
  period: ScorePeriod;
  periodEnd: Date;
  periodStart: Date;
}) {
  const locale = await getLocale();
  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  const serializedDataPoints = dataPoints.map((point) => ({
    date: point.date.toISOString(),
    label: point.label,
    score: point.score,
  }));

  return (
    <PerformanceChartLayout
      hasNext={hasNext}
      hasPrevious={hasPrevious}
      isEmpty={dataPoints.length === 0}
      periodLabel={periodLabel}
    >
      <ScoreChartClient average={average} dataPoints={serializedDataPoints} />
    </PerformanceChartLayout>
  );
}
