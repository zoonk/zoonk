import "server-only";
import { loadOwnedPlanContext } from "./_utils/owned-plan";
import { buildPlanView } from "./_utils/plan-view";
import { type PlanView } from "./plan-view-contract";

export type GoalPlanResult =
  | { plan: PlanView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * One of the learner's plans at every zoom level, as the screens and the API read it, with no other
 * daily time or date searched for it (the learner asks for those: see `findPlanTimeToCover`). The
 * learner's day comes from the goal's timezone, then the request's.
 */
export async function getGoalPlan(goalId: string): Promise<GoalPlanResult> {
  "use cache: private";

  const loaded = await loadOwnedPlanContext(goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  return { plan: await buildPlanView(loaded), status: "ready" };
}
