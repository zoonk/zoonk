import { type PlanScreenView, type PlanView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanFeasibility } from "../planner/plan-feasibility";

function toIsoOrNull(date: Date | null): string | null {
  return date ? toIsoDate(date) : null;
}

/** Shares go out as whole percentages' worth, so the screens never show "14.7%". */
export function roundShare(share: number): number {
  return Math.round(share * 100) / 100;
}

/** What fits in the learner's time, as the plan view says it. */
export function toFeasibilityView(feasibility: PlanFeasibility): PlanView["feasibility"] {
  return { ...toScreenFeasibilityView(feasibility), coreMinutes: feasibility.coreMinutes };
}

/** Omit the unused core-time search before it runs, rather than hiding its result afterward. */
export function toScreenFeasibilityView(
  feasibility: PlanFeasibility,
): NonNullable<PlanScreenView["feasibility"]> {
  const { maximum } = feasibility;

  return {
    alternative: feasibility.alternative
      ? {
          dailyMinutes: feasibility.alternative.dailyMinutes,
          endDate: toIsoOrNull(feasibility.alternative.endDate),
        }
      : null,
    coreFits: feasibility.coreFits,
    coveredShare: roundShare(feasibility.coveredShare),
    deadline: toIsoOrNull(feasibility.deadline),
    deepensMostAsked: feasibility.deepensMostAsked,
    fits: feasibility.fits,
    fittingDate: toIsoOrNull(feasibility.fittingDate),
    fullCourseEndDate: toIsoOrNull(feasibility.fullCourseEndDate),
    maximum: maximum
      ? { coveredShare: roundShare(maximum.coveredShare), dailyMinutes: maximum.dailyMinutes }
      : null,
    measure: feasibility.measure,
    recommendedMinutes: feasibility.recommendedMinutes,
    timeCovers: feasibility.timeCovers,
  };
}
