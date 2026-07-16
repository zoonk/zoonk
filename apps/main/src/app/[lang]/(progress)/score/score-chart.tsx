import { type ScoreDataPoint, type ScorePeriod } from "@/data/progress/get-score-history";
import { formatPeriodLabel } from "@zoonk/utils/date-ranges";
import { getLocale } from "next-intl/server";
import { ProgressChartLayout } from "../_components/progress-chart-layout";
import { ScoreChartClient } from "./score-chart-client";

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
    <ProgressChartLayout
      hasNext={hasNext}
      hasPrevious={hasPrevious}
      isEmpty={dataPoints.length === 0}
      periodLabel={periodLabel}
    >
      <ScoreChartClient average={average} dataPoints={serializedDataPoints} />
    </ProgressChartLayout>
  );
}
