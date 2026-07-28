import "server-only";
import { getContributionCalendarDateRangeFromEndDate } from "@zoonk/utils/contribution-calendar";
import { getSession } from "../users/get-session";
import { getProgressSession } from "./_utils/progress-cache";
import { type EnergyData, projectPersistedEnergy } from "./energy";
import { buildEnergyData, listEnergyCursors } from "./energy-queries";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getUserProgress } from "./get-user-progress";
import { hasUserLearningProgress } from "./user-progress";

/**
 * Returns current Energy, the visible 53-week timeline, and lifetime insights
 * for the authenticated learner using one request-local clock and timezone.
 */
export async function getEnergyData(): Promise<EnergyData | null> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return null;
  }

  const dateRange = getContributionCalendarDateRangeFromEndDate(dateContext.currentDate);

  const [progress, rows] = await Promise.all([
    getUserProgress(),
    listEnergyCursors({ userId: session.user.id }),
  ]);

  if (!hasUserLearningProgress(progress)) {
    return null;
  }

  const projection = projectPersistedEnergy({
    persistedEnergy: progress,
    targetDate: dateContext.currentDate,
    timeZone: dateContext.timeZone,
  });

  return buildEnergyData({ ...dateRange, currentEnergy: projection.currentEnergy, rows });
}

/**
 * Preserves the difference between an unauthenticated request and an
 * authenticated learner who has not created Energy history yet.
 */
export async function getCurrentUserEnergy(): Promise<{ energy: EnergyData | null } | null> {
  const [session, energy] = await Promise.all([getSession(), getEnergyData()]);
  return session ? { energy } : null;
}
