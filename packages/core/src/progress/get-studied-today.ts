import "server-only";
import { readDayProgress } from "../learner/facts/day-progress";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { getProgressSession } from "./_utils/progress-cache";
import { getRequestProgressDateContext } from "./get-request-date-context";

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
