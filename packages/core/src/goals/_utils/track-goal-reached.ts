import "server-only";
import { type Goal } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";

/**
 * "Goal Reached" when a goal becomes completed, with the days since the learner set it, after the
 * response. Admin's goals-reached stats count the same completions from the database.
 */
export function trackGoalReached(goal: Pick<Goal, "createdAt" | "id" | "userId">): void {
  const days = Math.floor((Date.now() - goal.createdAt.getTime()) / MS_PER_DAY);

  after(() =>
    trackLearnerEvents({
      events: [{ name: "Goal Reached", properties: { days, goal_id: goal.id } }],
      goalId: goal.id,
      userId: goal.userId,
    }),
  );
}
