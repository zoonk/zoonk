import "server-only";
import { getProgressSession } from "../../progress/_utils/progress-cache";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getScoreDateRange } from "../../progress/score-date-range";
import { type PlayerInitialProgress } from "../contracts/progress-snapshot";
import { getPlayerProgressSnapshot as queryPlayerProgressSnapshot } from "./get-progress-snapshot";

/**
 * Returns the authenticated learner's pre-completion milestone state. Optional
 * guests receive null, while infrastructure failures propagate so the owning
 * app can decide whether the player should use a graceful fallback.
 */
export async function getPlayerProgressSnapshot(): Promise<PlayerInitialProgress | null> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return null;
  }

  const dateRange = getScoreDateRange({
    now: dateContext.currentInstant,
    timeZone: dateContext.timeZone,
  });

  return queryPlayerProgressSnapshot({
    bestDayRange: dateRange.dailyProgress,
    timeZone: dateContext.timeZone,
    today: dateRange.dailyProgress.endDate,
    userId: session.user.id,
  });
}

/**
 * Wraps the player milestone snapshot as a current-user resource so an API
 * adapter can return 401 only for missing authentication while preserving the
 * valid all-zero snapshot of a new learner.
 */
export async function getCurrentUserProgressSnapshot(): Promise<{
  snapshot: PlayerInitialProgress;
} | null> {
  const snapshot = await getPlayerProgressSnapshot();
  return snapshot ? { snapshot } : null;
}
