import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import {
  ProgressMetricCard,
  ProgressMetricCardIcon,
  ProgressMetricCardLabel,
  ProgressMetricCardLabelSkeleton,
  ProgressMetricCardValue,
  ProgressMetricCardValueSkeleton,
} from "@/components/progress/progress-metric-card";
import { type EnergyInsightsData } from "@zoonk/core/progress/energy";
import { formatMetricPercent } from "@zoonk/utils/number";
import { GaugeIcon, ZapIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { ProgressInsightGrid } from "../_components/progress-insight-grid";

const AVERAGE_ENERGY_LABEL_ID = "energy-average-label";
const DAYS_AT_FULL_ENERGY_LABEL_ID = "energy-days-at-full-label";

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
    <ProgressMetricCard aria-labelledby={DAYS_AT_FULL_ENERGY_LABEL_ID} className="text-energy">
      <ProgressMetricCardIcon>
        <ZapIcon />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel id={DAYS_AT_FULL_ENERGY_LABEL_ID}>
        {t("Days at 100% Energy")}
      </ProgressMetricCardLabel>
      <ProgressMetricCardValue>{countLabel}</ProgressMetricCardValue>
    </ProgressMetricCard>
  );
}

/** Average Energy summarizes the learner's complete derived timeline. */
async function AverageEnergyCard({ averageEnergy }: { averageEnergy: number }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const formattedAverage = formatMetricPercent({ format, value: averageEnergy });

  return (
    <ProgressMetricCard aria-labelledby={AVERAGE_ENERGY_LABEL_ID} className="text-energy">
      <ProgressMetricCardIcon>
        <GaugeIcon />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel id={AVERAGE_ENERGY_LABEL_ID}>
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
