import { getEnergyHistory } from "@/data/progress/get-energy-history";
import { getSession } from "@zoonk/core/users/session/get";
import { validatePeriod } from "@zoonk/utils/date-ranges";
import { getLocale } from "next-intl/server";
import { ProgressChartSkeleton } from "../_components/progress-chart-skeleton";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { ProgressExplanationSkeleton } from "../_components/progress-explanation-skeleton";
import { EnergyChart } from "./energy-chart";
import { EnergyExplanation } from "./energy-explanation";
import { EnergyInsights, EnergyInsightsSkeleton } from "./energy-insights";
import { EnergyStats, EnergyStatsSkeleton } from "./energy-stats";

export async function EnergyContent({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;
  const validPeriod = validatePeriod(period);
  const locale = await getLocale();

  const [data, session] = await Promise.all([
    getEnergyHistory({ locale, offset: Number(offset), period: validPeriod }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <ProgressEmptyState isAuthenticated={isAuthenticated}>
        <EnergyExplanation />
      </ProgressEmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EnergyStats
        average={data.average}
        currentEnergy={data.currentEnergy}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        previousAverage={data.previousAverage}
      />

      <EnergyChart
        average={data.average}
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
      />

      <EnergyInsights
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
      />

      <EnergyExplanation />
    </div>
  );
}

export function EnergyContentSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <EnergyStatsSkeleton />
      <ProgressChartSkeleton />
      <EnergyInsightsSkeleton />
      <ProgressExplanationSkeleton />
    </div>
  );
}
