import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag } from "../cache/tags";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { getRequestInstant } from "../learner/facts/request-instant";
import { getSession } from "../users/get-session";

const DEFAULT_TIME_ZONE = "UTC";

type RequestProgressDateContext = { currentDate: Date; currentInstant: Date; timeZone: string };

/**
 * Captures one instant and the learner's day for it, so every progress capability in the same
 * render tree uses one clock. The day is in the learner's active goal's stored zone, as Today
 * reads it (see `getAnswerTimeZone`); UTC for a visitor without one.
 */
export async function getRequestProgressDateContext(): Promise<RequestProgressDateContext> {
  "use cache: private";

  const session = await getSession();
  const currentInstant = await getRequestInstant();

  if (session) {
    cacheTag(getGoalsCacheTag(session.user.id));
  }

  const timeZone = session
    ? await getLearnerTimeZone({ userId: session.user.id })
    : DEFAULT_TIME_ZONE;

  return {
    currentDate: getDateInTimeZone({ date: currentInstant, timeZone }),
    currentInstant,
    timeZone,
  };
}
