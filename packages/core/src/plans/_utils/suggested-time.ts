import { type MostCoverage, type TimeCoverage } from "../planner/plan-feasibility";
import { type PlanSuggestedTime } from "../time-advice-contract";
import { roundShare } from "./plan-feasibility-view";

/**
 * Few people keep up more focused study than this a day, so a goal that needs more is suggested
 * this much, with what it covers first; the time everything takes is still shown and can be picked.
 */
const LONGEST_SUGGESTED_MINUTES = 240;

export function getSuggestedTime({
  coverageAt,
  everything,
  most,
}: {
  coverageAt: (minutes: number) => TimeCoverage;
  everything: number | null;
  most: MostCoverage | null;
}): Omit<PlanSuggestedTime, "split"> {
  if (everything !== null && everything <= LONGEST_SUGGESTED_MINUTES) {
    return { coveredShare: 1, everyTopic: true, kind: "everything", minutes: everything };
  }

  const minutes = Math.min(most?.minutes ?? LONGEST_SUGGESTED_MINUTES, LONGEST_SUGGESTED_MINUTES);
  const { coreFits, coveredShare } = coverageAt(minutes);

  return { coveredShare: roundShare(coveredShare), everyTopic: coreFits, kind: "focus", minutes };
}
