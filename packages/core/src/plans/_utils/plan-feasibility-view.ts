import { type PlanView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanFeasibility } from "../planner/plan-feasibility";

/** Shares go out as whole percentages' worth, so the screens never show "14.7%". */
export function roundShare(share: number): number {
  return Math.round(share * 100) / 100;
}

/**
 * What the learner's own time covers by the goal's date, as the plan view says it: exact, read
 * from their plan. What other daily times or dates would do is never worked out for a read: the
 * learner asks for it (see `findPlanTimeToCover`).
 */
export function toFeasibilityView(feasibility: PlanFeasibility): PlanView["feasibility"] {
  return {
    coreFits: feasibility.coreFits,
    coveredShare: roundShare(feasibility.coveredShare),
    deadline: feasibility.deadline ? toIsoDate(feasibility.deadline) : null,
    deepensMostAsked: feasibility.deepensMostAsked,
    fits: feasibility.fits,
    measure: feasibility.measure,
    timeCovers: feasibility.timeCovers,
  };
}
