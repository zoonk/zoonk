import "server-only";
import { type UserProgress } from "@zoonk/db";
import {
  type BeltLevelResult,
  type NextBelt,
  calculateBeltLevel,
  getNextBelt,
} from "@zoonk/utils/belt-level";
import { getSession } from "../users/get-session";
import { getUserProgress } from "./get-user-progress";
import { hasUserLearningProgress } from "./user-progress";

export type BeltLevelDetails = BeltLevelResult & {
  nextBelt: NextBelt | null;
  totalBrainPower: number;
};

function toBeltLevel(progress: UserProgress | null): BeltLevelDetails | null {
  if (!hasUserLearningProgress(progress)) {
    return null;
  }

  const totalBrainPower = Number(progress.totalBrainPower);

  return {
    ...calculateBeltLevel(totalBrainPower),
    nextBelt: getNextBelt(totalBrainPower),
    totalBrainPower,
  };
}

/** Null without a session or learning progress. */
export async function getBeltLevel(): Promise<BeltLevelDetails | null> {
  "use cache: private";

  return toBeltLevel(await getUserProgress());
}

/** Outer null means unauthenticated; level=null means no visible learning progress yet. */
export async function getCurrentUserLevel(): Promise<{ level: BeltLevelDetails | null } | null> {
  const [session, level] = await Promise.all([getSession(), getBeltLevel()]);
  return session ? { level } : null;
}
