import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getMenu } from "@/lib/menu";
import { getEnergyData } from "@zoonk/core/progress/get-energy-data";
import { getEnergyStarted } from "@zoonk/core/progress/get-energy-started";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ZapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmpty, ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { EnergyChart, EnergyChartSkeleton } from "./energy-chart";
import { EnergyLine, EnergyTiles } from "./energy-stats";

/**
 * Before a day of study has passed, Energy has nothing to say yet: when it starts, as the buddy
 * says it, instead of a first day's few percent.
 */
async function EnergyStartsState() {
  const t = await getExtracted();

  return (
    <ProgressEmpty
      icon={<ZapIcon aria-hidden="true" />}
      title={t("Energy starts after your first day of study, and grows as you learn.")}
    />
  );
}

/**
 * Energy: its three numbers (now, its average and the days at full), the past 12 months in its
 * amber, and one line on how it moves. Nothing until a day of study has passed
 * (`getEnergyStarted`).
 */
export async function EnergyContent() {
  const [data, session, started] = await Promise.all([
    loadOptionalData(getEnergyData),
    getSession(),
    getEnergyStarted(),
  ]);

  if (!(data && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("energy").url} />;
  }

  if (!started) {
    return <EnergyStartsState />;
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
