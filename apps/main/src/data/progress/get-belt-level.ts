import "server-only";
import { hasUserLearningProgress } from "@zoonk/core/progress/user-progress";
import { type UserProgress } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { getUserProgress } from "./get-user-progress";

/** Converts a durable progress row into the belt shown by learner-facing UI. */
function toBeltLevel(progress: UserProgress | null): BeltLevelResult | null {
  if (!hasUserLearningProgress(progress)) {
    return null;
  }

  return calculateBeltLevel(Number(progress.totalBrainPower));
}

/** Returns the current belt for the authenticated learner. */
export async function getBeltLevel(): Promise<BeltLevelResult | null> {
  const progress = await getUserProgress();
  return toBeltLevel(progress);
}
