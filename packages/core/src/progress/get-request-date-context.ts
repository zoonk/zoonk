import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag } from "../cache/tags";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { readActiveGoal } from "../learner/facts/learning-profile";
import { getRequestInstant } from "../learner/facts/request-instant";
import { getSession } from "../users/get-session";

type RequestProgressDateContext = { currentDate: Date; currentInstant: Date; timeZone: string };

/**
 * Captures one instant and the learner's day for it, so every progress capability in the same
 * render tree uses one clock. The day is in the learner's active goal's stored zone, as Today
 * reads it (see `getAnswerTimeZone`); UTC for a visitor without one.
 */
export async function getRequestProgressDateContext(): Promise<RequestProgressDateContext> {
  "use cache: private";

  const [session, currentInstant] = await Promise.all([getSession(), getRequestInstant()]);

  if (session) {
    cacheTag(getGoalsCacheTag(session.user.id));
  }

  const goal = session ? await readActiveGoal(session.user.id) : null;
  const timeZone = getAnswerTimeZone({ goal });

  return {
    currentDate: getDateInTimeZone({ date: currentInstant, timeZone }),
    currentInstant,
    timeZone,
  };
}
