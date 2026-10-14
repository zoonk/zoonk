import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { moveGoalTimeZone } from "../../learner/_utils/goal-time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { ensureStudySession } from "../ensure-study-session";
import { findCarriedOverSession, hasStartedDay } from "./current-session";
import { refreshDayFromPlan } from "./refresh-day-session";
import { type StudySessionRow } from "./study-session-access";

/**
 * The learner's day for an active goal they own: the goal in the day's zone, since a learner who
 * moved takes the device's zone before the day starts (see `moveGoalTimeZone`), and the session
 * they're still in from before midnight, unless they already started the new day's, else today's,
 * built the first time it's opened and brought up to date with the plan without moving what the
 * learner was shown. Building the day can move the plan first (see `ensureStudySession`).
 *
 * Internal: public capabilities derive `userId` and the owned goal from the signed-in learner.
 */
export async function resolveTodaySession({
  goal: owned,
  timeZone: deviceTimeZone,
  userId,
}: {
  goal: Goal;
  timeZone?: string;
  userId: string;
}): Promise<{ session: StudySessionRow; timeZone: string }> {
  const moved = await moveGoalTimeZone({ goal: owned, now: new Date(), timeZone: deviceTimeZone });
  const goal = moved ? { ...owned, timezone: deviceTimeZone ?? null } : owned;
  const timeZone = getAnswerTimeZone({ goal, timeZone: deviceTimeZone });

  const now = new Date();
  const localDate = getDateInTimeZone({ date: now, timeZone });
  const carried = await findCarriedOverSession({ goalId: goal.id, now, timeZone, userId });

  if (carried && !(await hasStartedDay({ goalId: goal.id, localDate, userId }))) {
    return { session: carried, timeZone };
  }

  const today = await ensureStudySession({ goal, localDate, timeZone, userId });

  return { session: await refreshDayFromPlan({ session: today, timeZone }), timeZone };
}
