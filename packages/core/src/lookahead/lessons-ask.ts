import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { replanWaitingGoal } from "../library/curriculum/replan-waiting-goals";
import { afterPlanInputWrite, withPlanRetry } from "../plans/plan-conflict";
import {
  hasOutliningCourses,
  loadDayStandInCourseIds,
} from "../sessions/_utils/outlining-stand-ins";
import { followSavedDay } from "../sessions/_utils/refresh-study-day-selection";
import { findSavedDaySession } from "../sessions/_utils/saved-day-session";
import { getOutlineStaleBefore } from "./outline-ahead";

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

async function clearLessonsAsk({ askedAt, goalId }: { askedAt: number; goalId: string }) {
  await prisma.plan.updateMany({
    data: { lessonsAskedAt: null },
    where: { goalId, lessonsAskedAt: new Date(askedAt) },
  });
}

async function hasUnfinishedOutlines({
  askedAt,
  courseIds,
  now = new Date(),
}: {
  askedAt: number;
  courseIds: readonly string[];
  now?: Date;
}): Promise<boolean> {
  if (courseIds.length === 0) {
    return false;
  }

  const since = new Date(askedAt);

  if (since <= getOutlineStaleBefore(now)) {
    return hasOutliningCourses({ courseIds, now });
  }

  const ended = await prisma.course.count({
    where: {
      id: { in: [...courseIds] },
      outlineStatus: { in: ["completed", "failed"] },
      updatedAt: { gte: since },
    },
  });

  return ended < courseIds.length;
}

/** Trusted preparation only: the goal must come from an authorized POST or its workflow. */
export async function followWrittenLessons({
  askedAt,
  goalId,
}: {
  askedAt: number | null;
  goalId: string;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return;
  }

  const timeZone = getAnswerTimeZone({ goal });
  const now = new Date();

  if (askedAt !== null) {
    const courseIds = await loadDayStandInCourseIds({
      goal,
      localDate: getDateInTimeZone({ date: now, timeZone }),
    });

    if (!(await hasUnfinishedOutlines({ askedAt, courseIds, now }))) {
      await clearLessonsAsk({ askedAt, goalId });
    }
  }

  const session = await findSavedDaySession({
    goalId: goal.id,
    now,
    timeZone,
    userId: goal.userId,
  });

  if (session) {
    await followSavedDay({ session, timeZone });
  }
}

/**
 * A preparation that started an outline for a course the day needs leaves its ask for that
 * outline to end; otherwise it brings in the day's written lessons and ends the ask, unless a
 * newer request has replaced it.
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
    select: { id: true, primaryCourseId: true, timezone: true, userId: true },
    where: { id: goalId },
  });

  if (!goal) {
    return;
  }

  const timeZone = getAnswerTimeZone({ goal });
  const localDate = getDateInTimeZone({ date: new Date(), timeZone });
  const dayCourseIds = await loadDayStandInCourseIds({ goal, localDate });

  if (
    await hasUnfinishedOutlines({
      askedAt,
      courseIds: dayCourseIds.filter((courseId) => startedCourseIds.includes(courseId)),
    })
  ) {
    return;
  }

  if (dayCourseIds.length > 0) {
    await afterPlanInputWrite(() => withPlanRetry(() => replanWaitingGoal(goalId)));
  }

  await clearLessonsAsk({ askedAt, goalId });
  await afterPlanInputWrite(() => followWrittenLessons({ askedAt: null, goalId }));
}
