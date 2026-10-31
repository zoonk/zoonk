import { type TimeCoverage } from "../planner/plan-feasibility";
import { type PlanSuggestedTime } from "../time-advice-contract";
import { roundShare } from "./plan-feasibility-view";

/**
 * Few people keep up more focused study than this a day, so a goal that needs more is suggested
 * this much, with what it covers first; the time everything takes is still shown and can be picked.
 */
const LONGEST_SUGGESTED_MINUTES = 240;

/** `everything` is the day that covers the whole goal in depth by its date, null when no day does. */
export function getSuggestedTime({
  coverageAt,
  everything,
}: {
  coverageAt: (minutes: number) => TimeCoverage;
  everything: number | null;
}): Omit<PlanSuggestedTime, "split"> {
  if (everything !== null && everything <= LONGEST_SUGGESTED_MINUTES) {
    return { coveredShare: 1, everyTopic: true, kind: "everything", minutes: everything };
  }

  const { coreFits, coveredShare } = coverageAt(LONGEST_SUGGESTED_MINUTES);

  return {
    coveredShare: roundShare(coveredShare),
    everyTopic: coreFits,
    kind: "focus",
    minutes: LONGEST_SUGGESTED_MINUTES,
  };
}
