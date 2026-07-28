import "server-only";
import { type UserProgress } from "@zoonk/db";
import { type BeltLevelResult, calculateBeltLevel } from "@zoonk/utils/belt-level";
import { getSession } from "../users/get-session";
import { getUserProgress } from "./get-user-progress";
import { hasUserLearningProgress } from "./user-progress";

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
  "use cache: private";

  return toBeltLevel(await getUserProgress());
}

/**
 * Preserves the difference between an unauthenticated request and a signed-in
 * learner whose zeroed progress has not reached the first visible level yet.
 */
export async function getCurrentUserLevel(): Promise<{ level: BeltLevelDetails | null } | null> {
  const [session, level] = await Promise.all([getSession(), getBeltLevel()]);
  return session ? { level } : null;
}
