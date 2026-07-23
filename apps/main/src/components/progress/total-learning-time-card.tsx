import {
  ProgressMetricCard,
  ProgressMetricCardIcon,
  ProgressMetricCardLabel,
  ProgressMetricCardLabelSkeleton,
  ProgressMetricCardSubtitle,
  ProgressMetricCardSubtitleSkeleton,
  ProgressMetricCardTrailing,
  ProgressMetricCardValue,
  ProgressMetricCardValueSkeleton,
} from "@/components/progress/progress-metric-card";
import { ClockIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { getProgressLearningTimeLabel } from "./progress-learning-time-label";

/**
 * Learning time appears on multiple progress surfaces, so this shared card
 * keeps the learner-facing label, icon, and duration formatting aligned.
 */
export async function TotalLearningTimeCard({
  labelId,
  subtitle,
  totalLearningSeconds,
  trailing,
}: {
  labelId: string;
  subtitle?: string;
  totalLearningSeconds: number;
  trailing?: ReactNode;
}) {
  const t = await getExtracted();
  const timeLabel = await getProgressLearningTimeLabel({ totalSeconds: totalLearningSeconds });

  return (
    <ProgressMetricCard aria-labelledby={labelId}>
      <ProgressMetricCardIcon>
        <ClockIcon />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel id={labelId}>{t("Learning time")}</ProgressMetricCardLabel>
      {trailing && <ProgressMetricCardTrailing>{trailing}</ProgressMetricCardTrailing>}
      <ProgressMetricCardValue>{timeLabel}</ProgressMetricCardValue>
      {subtitle && <ProgressMetricCardSubtitle>{subtitle}</ProgressMetricCardSubtitle>}
    </ProgressMetricCard>
  );
}

/**
 * The progress grids reserve the same footprint for the total-time card while
 * server data streams in, which prevents the surrounding cards from shifting.
 */
export function TotalLearningTimeCardSkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-36" />
      <ProgressMetricCardValueSkeleton className="max-w-20" />
      <ProgressMetricCardSubtitleSkeleton className="max-w-36" />
    </ProgressMetricCard>
  );
}
