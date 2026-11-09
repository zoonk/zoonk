import "server-only";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { findSavedDaySession } from "../../sessions/_utils/saved-day-session";
import { getRequestInstant } from "./request-instant";

/** GET-only fact after ownership authorization: the saved session Today shows, including an active pre-midnight day. */
export async function readTodayPlanSession(userId: string, goalId: string, timeZone: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  const instant = await getRequestInstant();

  return findSavedDaySession({ goalId, now: instant, timeZone, userId });
}
