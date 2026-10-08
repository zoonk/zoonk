import "server-only";
import { type GoalKind } from "@zoonk/db";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { type PlanView } from "../../plans/plan-view-contract";
import { resolveViewGoal } from "../_utils/resolve-view-goal";

type PlanTabView = { goal: { id: string; kind: GoalKind; title: string }; plan: PlanView };

export type PlanTabViewResult =
  | { status: "noGoal" | "notFound" | "unauthorized" }
  | { status: "ready"; view: PlanTabView };

/**
 * The Plan tab for a goal (the active goal by default): the goal's header and its plan at every
 * zoom level. One cached read, so the tab prefetches whole.
 * The API serves the same data as `GET /v1/goals/{goalId}` and `GET /v1/goals/{goalId}/plan`.
 */
export async function getPlanTabView(input: { goalId?: string } = {}): Promise<PlanTabViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const result = await getGoalPlan(goal.id);

  if (result.status !== "ready") {
    return result;
  }

  return {
    status: "ready",
    view: { goal: { id: goal.id, kind: goal.kind, title: goal.title }, plan: result.plan },
  };
}
