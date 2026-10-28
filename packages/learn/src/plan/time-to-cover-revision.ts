import { type PlanView } from "@zoonk/core/plans/view-contract";

type SearchedPlan = Pick<
  PlanView,
  "areas" | "bases" | "examChoices" | "feasibility" | "planId" | "schedule" | "steering"
>;

/** The plan's id is in it, since another goal's plan can look the same and need another time; refreshes that change none of these keep the answer. */
export function getTimeToCoverRevision(plan: SearchedPlan): string {
  return JSON.stringify([
    plan.planId,
    plan.schedule,
    plan.feasibility,
    plan.steering,
    plan.areas,
    plan.bases,
    plan.examChoices,
  ]);
}
