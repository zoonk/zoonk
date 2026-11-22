import { MAX_SUGGESTED_DAILY_MINUTES } from "../daily-minutes";
import { type MostCoverage } from "../planner/most-coverage";
import { type TimeCoverage } from "../planner/plan-feasibility";
import { type PlanSuggestedTime } from "../time-advice-contract";
import { toShownShare } from "./plan-feasibility-view";

export function getSuggestedTime({
  coverageAt,
  everything,
  most,
}: {
  coverageAt: (minutes: number) => TimeCoverage;
  everything: number | null;
  most: MostCoverage | null;
}): Omit<PlanSuggestedTime, "split"> {
  if (everything !== null && everything <= MAX_SUGGESTED_DAILY_MINUTES) {
    return { coveredShare: 1, everyTopic: true, kind: "everything", minutes: everything };
  }

  const minutes = Math.min(
    most?.minutes ?? MAX_SUGGESTED_DAILY_MINUTES,
    MAX_SUGGESTED_DAILY_MINUTES,
  );

  const { coreFits, coveredShare } = coverageAt(minutes);

  return {
    coveredShare: toShownShare({ coveredShare, fits: false }),
    everyTopic: coreFits,
    kind: "focus",
    minutes,
  };
}
