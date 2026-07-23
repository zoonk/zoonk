import { getLearningActivity } from "@/data/progress/get-learning-activity";
import { getSession } from "@/data/users/get-session";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { ActivityChart, ActivityChartSkeleton } from "./activity-chart";
import { ActivityInsights, ActivityInsightsSkeleton } from "./activity-insights";
import { ActivityStats, ActivityStatsSkeleton } from "./activity-stats";

/**
 * Activity needs authentication context even when no timeline exists so its
 * empty state can distinguish a learner who should start from a visitor who
 * should log in.
 */
export async function ActivityContent() {
  const [activity, session] = await Promise.all([getLearningActivity(), getSession()]);
  const isAuthenticated = Boolean(session);

  if (!(activity && activity.totalLessonCompletions > 0)) {
    return <ProgressEmptyState isAuthenticated={isAuthenticated}>{null}</ProgressEmptyState>;
  }

  return (
    <ProgressContent>
      <ActivityStats totalLessonCompletions={activity.totalLessonCompletions} />
      <ActivityChart days={activity.days} />
      <ActivityInsights
        learningDays={activity.learningDays}
        totalLearningSeconds={activity.totalLearningSeconds}
      />
    </ProgressContent>
  );
}

/**
 * The streamed Activity fallback holds both major sections at their final size.
 */
export function ActivityContentSkeleton() {
  return (
    <ProgressContent>
      <ActivityStatsSkeleton />
      <ActivityChartSkeleton />
      <ActivityInsightsSkeleton />
    </ProgressContent>
  );
}
