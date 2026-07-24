import "server-only";
import { hasUserLearningProgress } from "@zoonk/core/progress/user-progress";
import { type UserProgress } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { getUserProgress } from "./get-user-progress";

export type BeltLevelDetails = BeltLevelResult & { totalBrainPower: number };

/** Converts one durable progress row into every value needed by belt progress surfaces. */
function toBeltLevel(progress: UserProgress | null): BeltLevelDetails | null {
  if (!hasUserLearningProgress(progress)) {
    return null;
  }

  const totalBrainPower = Number(progress.totalBrainPower);

  return { ...calculateBeltLevel(totalBrainPower), totalBrainPower };
}

/** Returns the authenticated learner's current belt and its durable total in one read. */
export async function getBeltLevel(): Promise<BeltLevelDetails | null> {
  const progress = await getUserProgress();
  return toBeltLevel(progress);
}
