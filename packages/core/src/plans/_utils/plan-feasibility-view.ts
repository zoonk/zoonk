import { type PlanView } from "../plan-view-contract";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type PlanFeasibility } from "../planner/plan-feasibility";
import { type SelectedCoverage } from "./selected-summary-contract";

export type ShownFeasibility = Pick<
  PlanFeasibility,
  "coreFits" | "coveredShare" | "deadline" | "deepensMostAsked" | "fits" | "measure" | "timeCovers"
>;

const LARGEST_SHORT_SHARE = 0.99;

/** Whole percents, where a share that falls short never shows as everything. */
export function toShownShare({ coveredShare, fits }: { coveredShare: number; fits: boolean }) {
  const rounded = Math.round(coveredShare * 100) / 100;
  return fits || coveredShare >= 1 ? rounded : Math.min(rounded, LARGEST_SHORT_SHARE);
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
    coveredShare: toShownShare(feasibility),
    deadline: feasibility.deadline ? toIsoDate(feasibility.deadline) : null,
    deepensMostAsked: feasibility.deepensMostAsked,
    fits: feasibility.fits,
    measure: feasibility.measure,
    timeCovers: feasibility.timeCovers,
  };
}
