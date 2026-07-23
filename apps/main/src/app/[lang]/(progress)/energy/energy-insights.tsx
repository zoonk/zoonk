import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import {
  ProgressMetricCard,
  ProgressMetricCardIcon,
  ProgressMetricCardLabel,
  ProgressMetricCardLabelSkeleton,
  ProgressMetricCardValue,
  ProgressMetricCardValueSkeleton,
} from "@/components/progress/progress-metric-card";
import { type EnergyInsightsData } from "@/data/progress/get-energy-insights";
import { formatMetricPercent } from "@zoonk/utils/number";
import { GaugeIcon, ZapIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { ProgressInsightGrid } from "../_components/progress-insight-grid";

/**
 * Energy insights answer two stable lifetime questions without repeating the
 * live value or introducing a date-control hierarchy.
 */
export function EnergyInsights({ insights }: { insights: EnergyInsightsData | null }) {
  if (!insights) {
    return null;
  }

  return (
    <ProgressInsightGrid>
      <AverageEnergyCard averageEnergy={insights.averageEnergy} />
      <FullEnergyCard count={insights.fullEnergyDays} />
    </ProgressInsightGrid>
  );
}

/**
 * Full-energy days remain useful at zero because they show how often the
 * learner has reached the maximum across their complete history.
 */
async function FullEnergyCard({ count }: { count: number }) {
  const t = await getExtracted();
  const countLabel = await getProgressDayCountLabel({ count });

  return (
    <ProgressMetricCard aria-labelledby="energy-full-energy-label" className="text-energy">
      <ProgressMetricCardIcon>
        <ZapIcon />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel id="energy-full-energy-label">
        {t("Full energy")}
      </ProgressMetricCardLabel>
      <ProgressMetricCardValue>{countLabel}</ProgressMetricCardValue>
    </ProgressMetricCard>
  );
}

/** Average Energy summarizes every stored learner day as one compact percent. */
async function AverageEnergyCard({ averageEnergy }: { averageEnergy: number }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const formattedAverage = formatMetricPercent({ format, value: averageEnergy });

  return (
    <ProgressMetricCard aria-labelledby="energy-average-label" className="text-energy">
      <ProgressMetricCardIcon>
        <GaugeIcon />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel id="energy-average-label">
        {t("Average Energy")}
      </ProgressMetricCardLabel>
      <ProgressMetricCardValue>{formattedAverage}</ProgressMetricCardValue>
    </ProgressMetricCard>
  );
}

/** Mirrors the final compact two-card layout while lifetime metrics stream. */
export function EnergyInsightsSkeleton() {
  return (
    <ProgressInsightGrid>
      <ProgressMetricCard aria-hidden="true" className="w-full">
        <ProgressMetricCardLabelSkeleton className="w-32" />
        <ProgressMetricCardValueSkeleton className="max-w-20" />
      </ProgressMetricCard>

      <ProgressMetricCard aria-hidden="true" className="w-full">
        <ProgressMetricCardLabelSkeleton className="w-24" />
        <ProgressMetricCardValueSkeleton className="max-w-28" />
      </ProgressMetricCard>
    </ProgressInsightGrid>
  );
}
