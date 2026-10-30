import { type PlanSuggestedTime, type PlanTimeToCover } from "../time-advice-contract";

/** Both times are null when more than a whole day would be needed, so neither is ever suggested then. */
export function getSuggestedTime({
  coreMinutes,
  recommendedMinutes,
}: Pick<PlanTimeToCover, "coreMinutes" | "recommendedMinutes">): Omit<
  PlanSuggestedTime,
  "split"
> | null {
  if (recommendedMinutes !== null) {
    return { kind: "everything", minutes: recommendedMinutes };
  }

  return coreMinutes === null ? null : { kind: "everyTopic", minutes: coreMinutes };
}
