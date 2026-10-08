import { getLearningActivity } from "@zoonk/core/progress/get-learning-activity";
import { getSession } from "@zoonk/core/users/session";
import { Surface } from "@zoonk/learn/surface";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { ActivityChart, ActivityChartSkeleton } from "./activity-chart";
import { ActivityStats, ActivityStatsSkeleton, ActivityTotalsLine } from "./activity-stats";

/**
 * Activity: the study days, the calendar of the past 12 months that lights them, and one line
 * with the lessons and time. Any learning day counts: a day of only reviews or practice too.
 * Visitors are asked to log in and learners without a learning day to start.
 */
export async function ActivityContent() {
  const [activity, session] = await Promise.all([getLearningActivity(), getSession()]);

  if (!(activity && activity.learningDays > 0)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} />;
  }

  return (
    <ProgressContent>
      <div className="px-1">
        <ActivityStats learningDays={activity.learningDays} />
      </div>
      <Surface className="p-4">
        <ActivityChart days={activity.days} />
      </Surface>
      <div className="px-1">
        <ActivityTotalsLine totals={activity} />
      </div>
    </ProgressContent>
  );
}

/** Holds the headline, calendar and line at their final size while data streams. */
export function ActivityContentSkeleton() {
  return (
    <ProgressContent>
      <div className="px-1">
        <ActivityStatsSkeleton />
      </div>
      <Surface className="p-4">
        <ActivityChartSkeleton />
      </Surface>
      <Skeleton className="mx-1 h-4 w-64 max-w-full" />
    </ProgressContent>
  );
}
