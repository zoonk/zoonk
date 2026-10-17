import { type PlanView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanFeasibility } from "../planner/plan-feasibility";
import { type SelectedCoverage } from "./selected-summary-contract";

/** What fits in the plan the Plan shows (see `readShownFeasibility`). */
export type ShownFeasibility = Pick<
  PlanFeasibility,
  "coreFits" | "coveredShare" | "deadline" | "deepensMostAsked" | "fits" | "measure" | "timeCovers"
>;

/** Shares go out as whole percentages' worth, so the screens never show "14.7%". */
export function roundShare(share: number): number {
  return Math.round(share * 100) / 100;
}

/**
 * What fits in the plan the Plan shows: what its summary covers (its saved allocation when the read
 * keeps it, see `selectDayPlanFromContext`), so the change that saved the plan and the read after
 * it say the same, where the read's own rebuild can lay its days out another way; the rest from
 * the read's feasibility. A plan that covers everything as it shows, the learner's time covers too.
 */
export function readShownFeasibility({
  coverage,
  feasibility,
}: {
  coverage: SelectedCoverage | null;
  feasibility: PlanFeasibility;
}): ShownFeasibility {
  if (!coverage) {
    return feasibility;
  }

  return {
    coreFits: coverage.coreFits,
    coveredShare: coverage.coveredShare ?? 1,
    deadline: feasibility.deadline,
    deepensMostAsked: feasibility.deepensMostAsked,
    fits: coverage.fits,
    measure: coverage.measure,
    timeCovers: coverage.fits || feasibility.timeCovers,
  };
}

/**
 * What the learner's own time covers by the goal's date, as the plan view says it: exact, read
 * from their plan. What other daily times or dates would do is never worked out for a read: the
 * learner asks for it (see `findPlanTimeToCover`).
 */
export function toFeasibilityView(feasibility: ShownFeasibility): PlanView["feasibility"] {
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
