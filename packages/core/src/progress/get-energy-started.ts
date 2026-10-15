import "server-only";
import {
  type ProgressHistoryOptions,
  readLifetimeDailyProgress,
} from "./_utils/daily-progress-rows";
import { hasEnergyStarted, hasEnergyStartedInRows } from "./_utils/energy-started";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";

/**
 * Whether the learner's Energy says anything yet: a day of study has passed. Until then the
 * buddy greets a brand-new learner awake, without an empty meter.
 */
export async function getEnergyStarted({ history }: ProgressHistoryOptions = {}): Promise<boolean> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return false;
  }

  if (history === "lifetime") {
    const rows = await readLifetimeDailyProgress(session.user.id);

    return hasEnergyStartedInRows({ rows, today: dateContext.currentDate });
  }

  return hasEnergyStarted({ today: dateContext.currentDate, userId: session.user.id });
}
