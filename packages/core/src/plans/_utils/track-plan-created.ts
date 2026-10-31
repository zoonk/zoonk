import "server-only";
import { type Goal } from "@zoonk/db";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { trackLearnerEvents } from "../../analytics/track-learner-event";

/**
 * Sent from the server, so the onboarding funnel counts it even when the page that asked was
 * closed.
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
