import "server-only";
import { type GoalKind } from "@zoonk/db";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { type PlanView } from "../../plans/plan-view-contract";
import { resolveViewGoal } from "../_utils/resolve-view-goal";
import { isCourseSetupLeft } from "../onboarding/onboarding-steps";

type PlanTabView = { goal: { id: string; kind: GoalKind; title: string }; plan: PlanView };

export type PlanTabViewResult =
  | { status: "noGoal" | "notFound" | "preparing" | "unauthorized" }
  | { status: "ready"; view: PlanTabView };

/** Requires goal ownership; unfinished course setup returns preparing because its default plan is not yet the learner's choice. */
export async function getPlanTabView(input: { goalId?: string } = {}): Promise<PlanTabViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  if (isCourseSetupLeft(goal)) {
    return { status: "preparing" };
  }

  const result = await getGoalPlan(goal.id);

  if (result.status !== "ready") {
    return result;
  }

  return {
    status: "ready",
    view: { goal: { id: goal.id, kind: goal.kind, title: goal.title }, plan: result.plan },
  };
}
