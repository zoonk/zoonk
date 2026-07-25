import { getEnergyData } from "@/data/progress/get-energy-data";
import { getSession } from "@/data/users/get-session";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { EnergyChart, EnergyChartSkeleton } from "./energy-chart";
import { EnergyExplanation, EnergyExplanationSkeleton } from "./energy-explanation";
import { EnergyInsights, EnergyInsightsSkeleton } from "./energy-insights";
import { EnergyStats, EnergyStatsSkeleton } from "./energy-stats";

export async function EnergyContent() {
  const [data, session] = await Promise.all([getEnergyData(), getSession()]);

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

      <EnergyInsights insights={data.insights} />

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
      <EnergyExplanationSkeleton />
    </ProgressContent>
  );
}
