import { type PlanView } from "@zoonk/core/plans/view-contract";

type AdvisedPlan = Pick<
  PlanView,
  "areas" | "bases" | "examChoices" | "feasibility" | "planId" | "schedule" | "steering"
>;

/**
 * What the Plan's advice (the time to cover everything, the prerequisites' recommendation) is
 * worked out from. The plan's id is in it, since another goal's plan can look the same and need
 * another answer, and so is the day the page was read for, since the days left change the answers;
 * refreshes that change none of these keep the answers.
 */
export function getPlanAdviceRevision({
  plan,
  today,
}: {
  plan: AdvisedPlan;
  today: string;
}): string {
  return JSON.stringify([
    today,
    plan.planId,
    plan.schedule,
    plan.feasibility,
    plan.steering,
    plan.areas,
    plan.bases,
    plan.examChoices,
  ]);
}
