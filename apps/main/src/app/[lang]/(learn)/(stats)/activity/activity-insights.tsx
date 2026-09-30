import { LearningDaysCard } from "@/components/progress/learning-days-card";
import {
  ProgressMetricCard,
  ProgressMetricCardLabelSkeleton,
  ProgressMetricCardValueSkeleton,
} from "@/components/progress/progress-metric-card";
import { TotalLearningTimeCard } from "@/components/progress/total-learning-time-card";
import { ProgressInsightGrid } from "../_components/progress-insight-grid";

/**
 * Keeps Activity's supporting lifetime metrics below the calendar, matching
 * the headline, chart, then insight-card hierarchy used by other progress pages.
 */
export function ActivityInsights({
  learningDays,
  totalLearningSeconds,
}: {
  learningDays: number;
  totalLearningSeconds: number;
}) {
  return (
    <ProgressInsightGrid>
      <LearningDaysCard count={learningDays} labelId="activity-learning-days-label" />
      <TotalLearningTimeCard
        labelId="activity-learning-time-label"
        totalLearningSeconds={totalLearningSeconds}
      />
    </ProgressInsightGrid>
  );
}

/** Keeps one supporting lifetime metric at its final compact height while data streams. */
function ActivityInsightSkeleton() {
  return (
    <ProgressMetricCard aria-hidden="true" className="w-full">
      <ProgressMetricCardLabelSkeleton className="w-32" />
      <ProgressMetricCardValueSkeleton className="max-w-24" />
    </ProgressMetricCard>
  );
}

/** Mirrors the final two-card Activity insight layout during streaming. */
export function ActivityInsightsSkeleton() {
  return (
    <ProgressInsightGrid>
      <ActivityInsightSkeleton />
      <ActivityInsightSkeleton />
    </ProgressInsightGrid>
  );
}
