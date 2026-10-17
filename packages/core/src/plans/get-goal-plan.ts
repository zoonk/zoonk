import "server-only";
import { loadOwnedPlanContext } from "./_utils/owned-plan";
import { buildPlanView } from "./_utils/plan-view";
import { type PlanScreenView, type PlanView } from "./plan-view-contract";

export type GoalPlanResult =
  | { plan: PlanView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

export type GoalPlanScreenResult =
  | { plan: PlanScreenView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * One of the learner's plans at every zoom level. The learner's day comes from the goal's timezone,
 * then the request's.
 */
export async function getGoalPlan(goalId: string): Promise<GoalPlanResult> {
  "use cache: private";

  const loaded = await loadOwnedPlanContext(goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  return { plan: await buildPlanView(loaded), status: "ready" };
}

/**
 * The same authenticated plan, as the screens read it: the same exact view the API gives, with no
 * other daily time or date searched for it (the learner asks for those: see `findPlanTimeToCover`).
 */
export async function getGoalPlanScreen(goalId: string): Promise<GoalPlanScreenResult> {
  "use cache: private";

  const loaded = await loadOwnedPlanContext(goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  return { plan: await buildPlanView({ ...loaded, screen: true }), status: "ready" };
}
