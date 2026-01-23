import { getLocale } from "next-intl/server";
import { PerformanceChartLayout } from "../_components/performance-chart-layout";
import { formatPeriodLabel } from "../_utils";
import { EnergyChartClient } from "./energy-chart-client";
import type { EnergyDataPoint, EnergyPeriod } from "@/data/progress/get-energy-history";

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
  const locale = await getLocale();
  const periodLabel = formatPeriodLabel(periodStart, periodEnd, period, locale);

  const serializedDataPoints = dataPoints.map((point) => ({
    date: point.date.toISOString(),
    energy: point.energy,
    label: point.label,
  }));

  return (
    <PerformanceChartLayout
      hasNext={hasNext}
      hasPrevious={hasPrevious}
      isEmpty={dataPoints.length === 0}
      periodLabel={periodLabel}
    >
      <EnergyChartClient average={average} dataPoints={serializedDataPoints} />
    </PerformanceChartLayout>
  );
}
