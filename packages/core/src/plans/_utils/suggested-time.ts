import { type PlanSuggestedTime, type PlanTimeToCover } from "../time-advice-contract";

/**
 * Few people keep up more focused study than this a day, so a goal that needs more starts on less
 * and says what it covers first. The learner can still pick any time.
 */
const LONGEST_SUGGESTED_MINUTES = 240;

function isSustainable(minutes: number | null): minutes is number {
  return minutes !== null && minutes <= LONGEST_SUGGESTED_MINUTES;
}

export function getSuggestedTime({
  coreMinutes,
  recommendedMinutes,
}: Pick<PlanTimeToCover, "coreMinutes" | "recommendedMinutes">): Omit<
  PlanSuggestedTime,
  "split"
> | null {
  if (isSustainable(recommendedMinutes)) {
    return { kind: "everything", minutes: recommendedMinutes };
  }

  return isSustainable(coreMinutes) ? { kind: "everyTopic", minutes: coreMinutes } : null;
}
