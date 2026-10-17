import { LearnerWitness } from "@/components/learner/learner-witness";
import { getMenu } from "@/lib/menu";
import { getLearningActivity } from "@zoonk/core/progress/get-learning-activity";
import { getSession } from "@zoonk/core/users/session";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { ActivityChart, ActivityChartSkeleton } from "./activity-chart";
import { ActivityTiles } from "./activity-stats";

/**
 * Activity: its three numbers (study days, lessons and time) and the past 12 months that light the
 * study days. Any learning day counts: a day of only reviews or practice too. Visitors are asked to
 * log in and learners without a learning day to start.
 */
export async function ActivityContent() {
  const [activity, session] = await Promise.all([getLearningActivity(), getSession()]);

  if (!(activity && activity.learningDays > 0)) {
    return (
      <>
        <LearnerWitness />
        <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("activity").url} />
      </>
    );
  }

  return (
    <ProgressContent>
      <LearnerWitness />
      <ActivityTiles activity={activity} />
      <ActivityChart days={activity.days} />
    </ProgressContent>
  );
}

/** Activity at its size while its days load: the tiles and the year. */
export function ActivityContentSkeleton() {
  return (
    <ProgressContent>
      <StatTilesSkeleton count={3} />
      <ActivityChartSkeleton />
    </ProgressContent>
  );
}
