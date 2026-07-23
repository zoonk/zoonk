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
import { BookCheckIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { getProgressLessonCountLabel } from "./progress-lesson-count-label";

/**
 * Completed lessons appears on multiple progress surfaces, so this shared card
 * keeps its learner-facing label, icon, and lesson-count formatting aligned.
 */
export async function CompletedLessonsCard({
  completedLessons,
  labelId,
  subtitle,
  trailing,
}: {
  completedLessons: number;
  labelId: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  const t = await getExtracted();
  const countLabel = await getProgressLessonCountLabel({ count: completedLessons });

  return (
    <ProgressMetricCard aria-labelledby={labelId}>
      <ProgressMetricCardIcon>
        <BookCheckIcon />
      </ProgressMetricCardIcon>
      <ProgressMetricCardLabel id={labelId}>{t("Lessons completed")}</ProgressMetricCardLabel>
      {trailing && <ProgressMetricCardTrailing>{trailing}</ProgressMetricCardTrailing>}
      <ProgressMetricCardValue>{countLabel}</ProgressMetricCardValue>
      <ProgressMetricCardSubtitle>{subtitle}</ProgressMetricCardSubtitle>
    </ProgressMetricCard>
  );
}

/**
 * Progress surfaces reserve the completed-lesson card footprint while its
 * lifetime total loads, which prevents the surrounding cards from shifting.
 */
export function CompletedLessonsCardSkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-36" />
      <ProgressMetricCardValueSkeleton className="max-w-24" />
      <ProgressMetricCardSubtitleSkeleton className="max-w-20" />
    </ProgressMetricCard>
  );
}
