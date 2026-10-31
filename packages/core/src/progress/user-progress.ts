import { type UserProgress } from "@zoonk/db";

/** Auth may create zeroed placeholder rows; only positive Brain Power or Energy represents learning. */
export function hasUserLearningProgress<
  TProgress extends Pick<UserProgress, "currentEnergy" | "totalBrainPower">,
>(progress: TProgress | null): progress is TProgress {
  if (!progress) {
    return false;
  }

  return progress.totalBrainPower > 0n || progress.currentEnergy > 0;
}
