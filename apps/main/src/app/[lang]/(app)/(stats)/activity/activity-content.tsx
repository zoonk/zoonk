import { getMenu } from "@/lib/menu";
import { getLearningActivity } from "@zoonk/core/progress/get-learning-activity";
import { getSession } from "@zoonk/core/users/session";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { ActivityChart, ActivityChartSkeleton } from "./activity-chart";
import { ActivityTiles } from "./activity-stats";

/** Any learning day counts, a day of only reviews or practice too. */
export async function ActivityContent() {
  const [activity, session] = await Promise.all([getLearningActivity(), getSession()]);

  if (!(activity && activity.learningDays > 0)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("activity").url} />;
  }

  return (
    <ProgressContent>
      <ActivityTiles activity={activity} />
      <ActivityChart days={activity.days} />
    </ProgressContent>
  );
}

export function ActivityContentSkeleton() {
  return (
    <ProgressContent>
      <StatTilesSkeleton count={3} />
      <ActivityChartSkeleton />
    </ProgressContent>
  );
}
