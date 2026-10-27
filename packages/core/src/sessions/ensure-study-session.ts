import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { PlanConflictError } from "../plans/plan-conflict";
import { openPlannedDay } from "./_utils/open-planned-day";
import { findSavedDaySession } from "./_utils/saved-day-session";
import { type StudySessionRow } from "./_utils/study-session-access";

/** Internal POST-only entry: the same selected plan and atomic writer as the explicit day open. */
export async function ensureStudySession(day: {
  goal: Goal;
  localDate: Date;
  timeZone: string;
  userId: string;
}): Promise<StudySessionRow> {
  const result = await openPlannedDay({ ...day, keepEmpty: true, now: new Date() });

  if (result.status === "opened") {
    return result.session;
  }

  if (result.status === "stale") {
    throw new PlanConflictError();
  }

  throw new Error(`The plan of goal ${day.goal.id} is not ready to open.`);
}

/**
 * Internal POST-only, for an activity outside the day's blocks (a drill, a call, a question to the
 * buddy, a lesson played from its chapter), before it records anything: Today plans a day nobody
 * opened yet again on every visit, so what the activity records would leave its missions with no
 * day to be credited to, and take the mission it did off Today. Saving the day first, with the
 * same writer as the explicit open, keeps the missions Today showed. It writes no AI work, as a
 * bare open doesn't. Best effort: a goal that isn't active, a rest day, a plan not ready yet or a
 * failure (logged) leave the activity as it was.
 */
export async function saveDayBeforeActivity({
  goalId,
  timeZone,
  userId,
}: {
  /** The goal whose Today offers what the activity completes; null saves nothing. */
  goalId: string | null;
  timeZone?: string;
  userId: string;
}): Promise<void> {
  if (!goalId) {
    return;
  }

  const { error } = await safeAsync(async () => {
    const goal = await prisma.goal.findFirst({ where: { id: goalId, status: "active", userId } });

    if (!goal) {
      return;
    }

    const now = new Date();
    const zone = getAnswerTimeZone({ goal, timeZone });

    // A saved day, or the one from before midnight the learner is still in, takes the credit.
    if (await findSavedDaySession({ goalId, now, timeZone: zone, userId })) {
      return;
    }

    await openPlannedDay({
      goal,
      localDate: getDateInTimeZone({ date: now, timeZone: zone }),
      now,
      timeZone: zone,
      userId,
    });
  });

  if (error) {
    logError(`[saveDayBeforeActivity] Could not save today's day of goal ${goalId}:`, error);
  }
}
