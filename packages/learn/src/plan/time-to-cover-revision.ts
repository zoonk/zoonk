import { type PlanScreenView } from "@zoonk/core/plans/view-contract";

/** What of the plan Find searched (see `getTimeToCoverRevision`). */
type SearchedPlan = Pick<
  PlanScreenView,
  "areas" | "bases" | "examChoices" | "feasibility" | "planId" | "schedule" | "steering"
>;

/**
 * What Find searched, as a key: the plan it's for (another goal's plan can look the same and need
 * another time), its week, date and time, what it covers, where it focuses, its bases and its exam
 * choices. Lessons being written, a session's progress or new changes in the list refresh the plan
 * without changing that, so an answer (or a search still running) stays.
 */
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
