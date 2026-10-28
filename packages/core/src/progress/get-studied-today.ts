import "server-only";
import { readDayProgress } from "../learner/facts/day-progress";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";

/**
 * Whether the learner studied on their current day. Learning is what wakes the buddy, so a buddy
 * never naps on a day with study, even while Energy is still low. It reads the same daily totals
 * the buddy's page and Today read.
 */
export async function getStudiedToday(): Promise<boolean> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return false;
  }

  const today = await readDayProgress(session.user.id, toIsoDate(dateContext.currentDate));

  return (today?.timeSpentSeconds ?? 0) > 0;
}
