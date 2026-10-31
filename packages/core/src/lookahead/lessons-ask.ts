import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { replanWaitingGoal } from "../library/curriculum/replan-waiting-goals";
import { afterPlanInputWrite, withPlanRetry } from "../plans/plan-conflict";
import { loadDayStandInCourseIds } from "../sessions/_utils/outlining-stand-ins";
import { followSavedDay } from "../sessions/_utils/refresh-study-day-selection";
import { findSavedDaySession } from "../sessions/_utils/saved-day-session";

/**
 * The learner asked for their plan's lessons, so their day reads as getting them while the
 * preparation this request starts decides what to outline. Returns the ask for that preparation to
 * end, or null without a plan. Authorize the goal first.
 */
export async function askForLessons({
  db = prisma,
  goalId,
  now = new Date(),
}: {
  db?: TransactionClient;
  goalId: string;
  now?: Date;
}): Promise<number | null> {
  const { count } = await db.plan.updateMany({ data: { lessonsAskedAt: now }, where: { goalId } });

  return count > 0 ? now.getTime() : null;
}

async function followShownDay({
  goal,
  timeZone,
}: {
  goal: { id: string; userId: string };
  timeZone: string;
}): Promise<void> {
  const session = await findSavedDaySession({
    goalId: goal.id,
    now: new Date(),
    timeZone,
    userId: goal.userId,
  });

  if (session?.goal) {
    const { goal: sessionGoal } = session;
    await afterPlanInputWrite(() => followSavedDay({ goal: sessionGoal, session, timeZone }));
  }
}

/**
 * A preparation that started an outline for a course the day needs keeps its ask until it goes
 * stale; otherwise it brings in the day's lessons written since the plan was saved and ends the
 * ask, unless a newer request has replaced it.
 */
export async function endLessonsAsk({
  askedAt,
  goalId,
  startedCourseIds,
}: {
  askedAt: number;
  goalId: string;
  startedCourseIds: readonly string[];
}): Promise<void> {
  const goal = await prisma.goal.findUnique({
    select: {
      id: true,
      kind: true,
      primaryCourseId: true,
      targetDate: true,
      timezone: true,
      userId: true,
    },
    where: { id: goalId },
  });

  if (!goal) {
    return;
  }

  const timeZone = getAnswerTimeZone({ goal });
  const localDate = getDateInTimeZone({ date: new Date(), timeZone });
  const dayCourseIds = await loadDayStandInCourseIds({ goal, localDate });

  if (dayCourseIds.some((courseId) => startedCourseIds.includes(courseId))) {
    return;
  }

  if (dayCourseIds.length > 0) {
    await afterPlanInputWrite(() => withPlanRetry(() => replanWaitingGoal(goalId)));
  }

  await prisma.plan.updateMany({
    data: { lessonsAskedAt: null },
    where: { goalId, lessonsAskedAt: new Date(askedAt) },
  });

  // While the ask is fresh the day reads as awaiting outlines, and Continue's append waits for them.
  if (dayCourseIds.length > 0) {
    await followShownDay({ goal, timeZone });
  }
}
