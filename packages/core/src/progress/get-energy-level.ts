import "server-only";
import { getProgressSession } from "./_utils/progress-cache";
import { type EnergyLevelData, projectPersistedEnergy } from "./energy";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getUserProgress } from "./get-user-progress";
import { hasUserLearningProgress } from "./user-progress";

/**
 * Returns current Energy for the authenticated learner without loading daily history.
 */
export async function getEnergyLevel(): Promise<EnergyLevelData | null> {
  "use cache: private";

  const [progress, dateContext] = await Promise.all([
    getUserProgress(),
    getRequestProgressDateContext(),
    getProgressSession(),
  ]);

  if (!hasUserLearningProgress(progress)) {
    return null;
  }

  const projection = projectPersistedEnergy({
    persistedEnergy: progress,
    targetDate: dateContext.currentDate,
    timeZone: dateContext.timeZone,
  });

  return { currentEnergy: projection.currentEnergy };
}
