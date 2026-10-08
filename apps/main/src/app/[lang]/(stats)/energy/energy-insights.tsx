import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import { type EnergyData } from "@zoonk/core/progress/energy";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import { StatTile, StatTileGrid } from "../_components/stat-tile";

/** Energy over the learner's whole history: its average, and the days it reached its maximum. */
export async function EnergyInsights({ insights }: { insights: EnergyData["insights"] }) {
  const [t, format] = await Promise.all([getExtracted(), getFormatter()]);

  if (!insights) {
    return null;
  }

  return (
    <StatTileGrid>
      <StatTile
        label={t("Average Energy")}
        metric="energy"
        value={formatMetricPercent({ format, value: insights.averageEnergy })}
      />
      <StatTile
        label={t("Days at Max Energy")}
        metric="energy"
        value={await getProgressDayCountLabel({ count: insights.fullEnergyDays })}
      />
    </StatTileGrid>
  );
}

export function EnergyInsightsSkeleton() {
  return (
    <StatTileGrid aria-hidden="true">
      <Skeleton className="h-31 rounded-2xl" />
      <Skeleton className="h-31 rounded-2xl" />
    </StatTileGrid>
  );
}
