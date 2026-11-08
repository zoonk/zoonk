import "server-only";
import { readCurriculumRebuild } from "../learner/facts/curriculum-rebuild";
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

  const [plan, rebuilding] = await Promise.all([
    buildPlanView(loaded),
    readCurriculumRebuild(loaded.context.goal.userId, goalId),
  ]);

  return { plan: { ...plan, ready: plan.ready && !rebuilding }, status: "ready" };
}
