import { type UserProgress } from "@zoonk/db";

/**
 * Auth sign-up and migrations can create zeroed UserProgress rows before a
 * learner completes anything. Progress surfaces should treat those rows like
 * empty state, and lesson completion should not apply inactivity decay to them.
 * Any positive brain power or energy means the row represents real learning
 * history instead of a placeholder.
 */
export function hasUserLearningProgress<
  TProgress extends Pick<UserProgress, "currentEnergy" | "totalBrainPower">,
>(progress: TProgress | null): progress is TProgress {
  if (!progress) {
    return false;
  }

  return progress.totalBrainPower > 0n || progress.currentEnergy > 0;
}
