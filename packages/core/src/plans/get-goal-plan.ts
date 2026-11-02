import "server-only";
import { loadOwnedPlanContext } from "./_utils/owned-plan";
import { buildPlanView } from "./_utils/plan-view";
import { type PlanView } from "./plan-view-contract";

export type GoalPlanResult =
  | { plan: PlanView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

export async function getGoalPlan(goalId: string): Promise<GoalPlanResult> {
  "use cache: private";

  const loaded = await loadOwnedPlanContext(goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  return { plan: await buildPlanView(loaded), status: "ready" };
}
