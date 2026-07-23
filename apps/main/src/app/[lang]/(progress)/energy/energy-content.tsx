import { getEnergyHistory } from "@/data/progress/get-energy-history";
import { getEnergyInsights } from "@/data/progress/get-energy-insights";
import { getSession } from "@/data/users/get-session";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { ProgressExplanationSkeleton } from "../_components/progress-explanation-skeleton";
import { EnergyChart, EnergyChartSkeleton } from "./energy-chart";
import { EnergyExplanation } from "./energy-explanation";
import { EnergyInsights, EnergyInsightsSkeleton } from "./energy-insights";
import { EnergyStats, EnergyStatsSkeleton } from "./energy-stats";

export async function EnergyContent() {
  const [data, insights, session] = await Promise.all([
    getEnergyHistory(),
    getEnergyInsights(),
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
    <ProgressContent>
      <EnergyStats currentEnergy={data.currentEnergy} />

      <EnergyChart days={data.days} />

      <EnergyInsights insights={insights} />

      <EnergyExplanation />
    </ProgressContent>
  );
}

export function EnergyContentSkeleton() {
  return (
    <ProgressContent>
      <EnergyStatsSkeleton />
      <EnergyChartSkeleton />
      <EnergyInsightsSkeleton />
      <ProgressExplanationSkeleton />
    </ProgressContent>
  );
}
