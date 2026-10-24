import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getMenu } from "@/lib/menu";
import { getEnergyData } from "@zoonk/core/progress/get-energy-data";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { EnergyChart, EnergyChartSkeleton } from "./energy-chart";
import { EnergyLine, EnergyTiles } from "./energy-stats";

/**
 * Energy: its three numbers (now, its average and the days at full), the past 12 months in its
 * amber, and one line on how it moves, from the first thing learned.
 */
export async function EnergyContent() {
  const [data, session] = await Promise.all([loadOptionalData(getEnergyData), getSession()]);

  if (!(data && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("energy").url} />;
  }

  return (
    <ProgressContent>
      <EnergyTiles currentEnergy={data.currentEnergy} insights={data.insights} />
      <EnergyChart days={data.days} />
      <EnergyLine />
    </ProgressContent>
  );
}

/** Energy at its size while its history loads: the tiles, the year and the line. */
export function EnergyContentSkeleton() {
  return (
    <ProgressContent>
      <StatTilesSkeleton count={3} />
      <EnergyChartSkeleton />
      <Skeleton className="h-4 w-72 max-w-full" />
    </ProgressContent>
  );
}
