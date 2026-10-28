import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getUserProgressCacheTag } from "../cache/tags";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { readOwnedGoal } from "../learner/facts/owned-goal";
import { getRequestInstant } from "../learner/facts/request-instant";
import { getSession } from "../users/get-session";
import { loadStudyWeek } from "./_utils/load-study-week";
import { type WeeklyStudyTime } from "./weekly-study-time-contract";

export type GoalWeekTimeResult =
  | { status: "notFound" | "unauthorized" }
  | { status: "ready"; weekTime: WeeklyStudyTime };

/**
 * The time the learner studied this week against their shared weekly budget, in the week of the
 * goal's day: what the Plan's pace shows, the same numbers Today's week has.
 */
export async function getGoalWeekTime(goalId: string): Promise<GoalWeekTimeResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  cacheTag(getGoalsCacheTag(userId), getUserProgressCacheTag(userId));

  const [goal, now] = await Promise.all([readOwnedGoal(userId, goalId), getRequestInstant()]);

  if (!goal) {
    return { status: "notFound" };
  }

  const week = await loadStudyWeek({
    localDate: getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal }) }),
    userId,
  });

  return { status: "ready", weekTime: week.time };
}
