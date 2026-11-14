import { type PlanView } from "@zoonk/core/plans/view-contract";

type AdvisedPlan = Pick<
  PlanView,
  "areas" | "bases" | "examChoices" | "feasibility" | "planId" | "schedule" | "steering"
>;

/**
 * What the Plan's advice (the time to cover everything, the prerequisites' recommendation) is
 * worked out from. The plan's id is in it, since another goal's plan can look the same and need
 * another answer; refreshes that change none of these keep the answers.
 */
export function getPlanAdviceRevision(plan: AdvisedPlan): string {
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
