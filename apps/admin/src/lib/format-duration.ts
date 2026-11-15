import { formatDuration as formatLearnerDuration } from "@zoonk/utils/duration";

/** A duration as the learner apps write it: "15 hr 31 min", "40 min". */
export function formatDuration(totalSeconds: number): string {
  return formatLearnerDuration({ locale: "en", totalSeconds });
}
