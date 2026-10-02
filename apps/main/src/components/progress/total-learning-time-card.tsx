import {
  ProgressMetricCard,
  ProgressMetricCardIcon,
  ProgressMetricCardLabel,
  ProgressMetricCardSubtitle,
  ProgressMetricCardTrailing,
  ProgressMetricCardValue,
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
