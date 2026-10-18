import "server-only";
import { type Goal } from "@zoonk/db";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { trackLearnerEvents } from "../../analytics/track-learner-event";

/**
 * "Plan Created", sent from the server when a goal's plan is built for the first time, so the
 * onboarding funnel counts it even when the page that asked for it was closed. Quick
 * explanations have a plan item too, but they aren't plans the learner made.
 */
export async function trackPlanCreated({
  estimateHours,
  fromPlanLink,
  goal,
  phases,
  platform,
}: {
  estimateHours: number | null;
  fromPlanLink: boolean;
  goal: Pick<Goal, "id" | "kind" | "userId">;
  phases: number;
  platform?: AnalyticsPlatform | null;
}): Promise<void> {
  if (goal.kind === "explain") {
    return;
  }

  await trackLearnerEvents({
    events: [
      {
        name: "Plan Created",
        properties: {
          estimate_hours: estimateHours,
          from_plan_link: fromPlanLink,
          goal_id: goal.id,
          phases,
        },
      },
    ],
    goalId: goal.id,
    platform,
    userId: goal.userId,
  });
}
