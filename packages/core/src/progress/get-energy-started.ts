import "server-only";
import { hasEnergyStarted } from "./_utils/energy-started";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";

/**
 * Whether the learner's Energy says anything yet: a day of study has passed. Until then the
 * buddy greets a brand-new learner awake, without an empty meter.
 */
export async function getEnergyStarted(): Promise<boolean> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return false;
  }

  return hasEnergyStarted({ today: dateContext.currentDate, userId: session.user.id });
}
