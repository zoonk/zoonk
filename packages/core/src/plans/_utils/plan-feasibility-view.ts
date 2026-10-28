import { type PlanView } from "../plan-view-contract";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type PlanFeasibility } from "../planner/plan-feasibility";
import { type SelectedCoverage } from "./selected-summary-contract";

export type ShownFeasibility = Pick<
  PlanFeasibility,
  "coreFits" | "coveredShare" | "deadline" | "deepensMostAsked" | "fits" | "measure" | "timeCovers"
>;

export function roundShare(share: number): number {
  return Math.round(share * 100) / 100;
}

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
    deadline: fromIsoDate(coverage.deadline),
    deepensMostAsked: feasibility.deepensMostAsked,
    fits: coverage.fits,
    measure: coverage.measure,
    timeCovers: coverage.fits || feasibility.timeCovers,
  };
}

export function toFeasibilityView(
  feasibility: ShownFeasibility,
): NonNullable<PlanView["feasibility"]> {
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
