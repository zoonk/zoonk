import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadPlanAtToken } from "../plans/_utils/plan-token";
import { PlanConflictError, withPlanRetry } from "../plans/plan-conflict";
import { loadDailyTimeLimitStatus } from "./_utils/daily-time-limit";
import { getGoalDayMinutes } from "./_utils/day-minutes";
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
  return withPlanRetry(async () => {
    const now = new Date();
    const context = await loadPlanAtToken(day.goal.id, { now, timeZone: day.timeZone });

    if (!context || context.goal.userId !== day.userId) {
      throw new Error(`The plan of goal ${day.goal.id} is not ready to open.`);
    }

    const result = await openPlannedDay({
      ...day,
      goal: context.goal,
      keepEmpty: true,
      localDate: context.today,
      now,
      timeZone: context.timeZone,
    });

    if (result.status === "opened") {
      return result.session;
    }

    if (result.status === "stale") {
      throw new PlanConflictError();
    }

    throw new Error(`The plan of goal ${day.goal.id} is not ready to open.`);
  });
}

/**
 * The goal whose Today offers what an activity outside the day's blocks completes: the one the
 * request names (a pronunciation round's, a notebook run's, a call's), else the one Today shows.
 * Only the learner's own active goal; for an activity in a language (a drill, a round, a call),
 * only a language goal learning it, as only those offer its missions (see `languageCandidates`).
 */
async function findActivityGoal({
  goalId,
  language,
  userId,
}: {
  goalId?: string;
  language?: string | null;
  userId: string;
}): Promise<Goal | null> {
  const id = goalId ?? (await findActiveGoalId(userId));
  const goal = id ? await prisma.goal.findFirst({ where: { id, status: "active", userId } }) : null;

  if (language !== undefined && (goal?.kind !== "language" || goal.targetLanguage !== language)) {
    return null;
  }

  return goal;
}

/**
 * Internal POST-only, for an activity outside the day's blocks (a drill, a call, a question to the
 * buddy, a lesson played from its chapter), before it records anything: Today plans a day nobody
 * opened yet again on every visit, so what the activity records would leave its missions with no
 * day to be credited to, and take the mission it did off Today. Saving the day of the goal whose
 * Today offers it (`findActivityGoal`) first, with the same writer as the explicit open, keeps the
 * missions Today showed. It writes no AI work, as a bare open doesn't. Best effort: no such goal,
 * a rest day, a used-up daily limit, a plan not ready yet or a failure (logged) leave the
 * activity as it was.
 */
export async function saveDayBeforeActivity({
  goalId,
  language,
  timeZone,
  userId,
}: {
  /** The goal the request says the activity is for; without one, the goal Today shows. */
  goalId?: string;
  /** The language a drill, a round or a call is in; null for one in no goal's language. */
  language?: string | null;
  timeZone?: string;
  userId: string;
}): Promise<void> {
  const { error } = await safeAsync(async () => {
    const goal = await findActivityGoal({ goalId, language, userId });

    if (!goal) {
      return;
    }

    const now = new Date();
    const zone = getAnswerTimeZone({ goal, timeZone });

    // A saved day, or the one from before midnight the learner is still in, takes the credit.
    if (await findSavedDaySession({ goalId: goal.id, now, timeZone: zone, userId })) {
      return;
    }

    const localDate = getDateInTimeZone({ date: now, timeZone: zone });

    const [plan, limit] = await Promise.all([
      prisma.plan.findUnique({ select: { settings: true }, where: { goalId: goal.id } }),
      loadDailyTimeLimitStatus({ date: localDate, userId }),
    ]);

    // A rest day, or one whose study time is used up, offers no missions and opens empty: each of
    // the activity's requests (every answer of a round) would plan it again only to save nothing.
    if (
      limit.reached ||
      getGoalDayMinutes({ date: localDate, goal, planSettings: plan?.settings }) === 0
    ) {
      return;
    }

    await openPlannedDay({ goal, localDate, now, timeZone: zone, userId });
  });

  if (error) {
    logError("[saveDayBeforeActivity] Could not save today's day:", error);
  }
}
