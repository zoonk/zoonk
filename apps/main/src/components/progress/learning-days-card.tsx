import {
  ProgressMetricCard,
  ProgressMetricCardIcon,
  ProgressMetricCardLabel,
  ProgressMetricCardSubtitle,
  ProgressMetricCardTrailing,
  ProgressMetricCardValue,
} from "@/components/progress/progress-metric-card";
import { CalendarDaysIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { getProgressDayCountLabel } from "./progress-day-count-label";

/**
 * Learning days appears on multiple progress surfaces, so this shared card
 * keeps the learner-facing label, icon, and day-count formatting aligned.
 */
export async function LearningDaysCard({
  count,
  labelId,
  subtitle,
  trailing,
}: {
  count: number;
  labelId: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  const t = await getExtracted();
  const countLabel = await getProgressDayCountLabel({ count });

  return (
    <ProgressMetricCard aria-labelledby={labelId}>
      <ProgressMetricCardIcon>
        <CalendarDaysIcon />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel id={labelId}>{t("Learning days")}</ProgressMetricCardLabel>
      {trailing && <ProgressMetricCardTrailing>{trailing}</ProgressMetricCardTrailing>}
      <ProgressMetricCardValue>{countLabel}</ProgressMetricCardValue>
      {subtitle && <ProgressMetricCardSubtitle>{subtitle}</ProgressMetricCardSubtitle>}
    </ProgressMetricCard>
  );
}
