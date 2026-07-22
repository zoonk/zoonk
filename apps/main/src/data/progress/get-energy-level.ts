import "server-only";
import { hasUserLearningProgress } from "@zoonk/core/progress/user-progress";
import { type UserProgress } from "@zoonk/db";
import { computeDecayedEnergy } from "@zoonk/utils/energy";
import { getUserProgress } from "./get-user-progress";

type EnergyLevelData = { currentEnergy: number };

/**
 * Captures the approximate time used for daily Energy decay. Keeping this
 * producer local makes its default cache-window drift part of Energy behavior
 * instead of exposing a generic cached clock to unrelated features.
 */
async function getEnergyCalculationDate(): Promise<Date> {
  "use cache";

  return new Date();
}

/**
 * Calculates time-sensitive energy from a durable progress row and an explicit timestamp.
 */
function toEnergyLevel({
  now,
  progress,
}: {
  now: Date;
  progress: UserProgress | null;
}): EnergyLevelData | null {
  if (!hasUserLearningProgress(progress)) {
    return null;
  }

  return {
    currentEnergy: computeDecayedEnergy(progress.currentEnergy, progress.lastActiveAt, now),
  };
}

/** Returns the current Energy level for the authenticated learner. */
export async function getEnergyLevel(): Promise<EnergyLevelData | null> {
  const [now, progress] = await Promise.all([getEnergyCalculationDate(), getUserProgress()]);
  return toEnergyLevel({ now, progress });
}
