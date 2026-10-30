import { type PlanSuggestedTime, type PlanTimeToCover } from "../time-advice-contract";

/** More time a day than this is never a learner's starting time, even when it's what covers it all. */
const LONGEST_SUGGESTED_MINUTES = 240;

export function getSuggestedTime({
  coreMinutes,
  recommendedMinutes,
}: Pick<PlanTimeToCover, "coreMinutes" | "recommendedMinutes">): PlanSuggestedTime | null {
  if (recommendedMinutes !== null && recommendedMinutes <= LONGEST_SUGGESTED_MINUTES) {
    return { kind: "everything", minutes: recommendedMinutes };
  }

  if (coreMinutes !== null && coreMinutes <= LONGEST_SUGGESTED_MINUTES) {
    return { kind: "everyTopic", minutes: coreMinutes };
  }

  return null;
}
