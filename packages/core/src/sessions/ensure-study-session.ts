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

/** Only active owned goals qualify; language activities credit only goals learning that language. */
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

/** Internal POST-only; save the shown day's missions before recording off-session activity, logging failures without blocking it. */
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

    // An unfinished pre-midnight session retains the activity credit.
    if (await findSavedDaySession({ goalId: goal.id, now, timeZone: zone, userId })) {
      return;
    }

    const localDate = getDateInTimeZone({ date: now, timeZone: zone });

    const [plan, limit] = await Promise.all([
      prisma.plan.findUnique({ select: { settings: true }, where: { goalId: goal.id } }),
      loadDailyTimeLimitStatus({ date: localDate, userId }),
    ]);

    // Empty rest/limited days offer no missions, so repeated activity requests must not keep planning them.
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
