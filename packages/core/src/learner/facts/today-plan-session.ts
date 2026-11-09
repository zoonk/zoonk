import "server-only";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { findSavedDaySession } from "../../sessions/_utils/saved-day-session";
import { getAnswerTimeZone } from "../_utils/owned-goal";
import { readOwnedGoal } from "./owned-goal";
import { getRequestInstant } from "./request-instant";

/** GET-only fact after ownership authorization: the saved session Today shows, including an active pre-midnight day. */
export async function readTodayPlanSession(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  const [goal, instant] = await Promise.all([readOwnedGoal(userId, goalId), getRequestInstant()]);

  return findSavedDaySession({
    goalId,
    now: instant,
    timeZone: getAnswerTimeZone({ goal }),
    userId,
  });
}
