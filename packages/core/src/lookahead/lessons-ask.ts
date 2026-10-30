import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadDayStandInCourseIds } from "../sessions/_utils/outlining-stand-ins";

/**
 * The learner asked for their plan's lessons, so their day reads as getting them while the
 * preparation this request starts decides what to outline. Returns the ask for that preparation to
 * end, or null without a plan. Authorize the goal first.
 */
export async function askForLessons({
  goalId,
  now = new Date(),
}: {
  goalId: string;
  now?: Date;
}): Promise<number | null> {
  const { count } = await prisma.plan.updateMany({
    data: { lessonsAskedAt: now },
    where: { goalId },
  });

  return count > 0 ? now.getTime() : null;
}

/**
 * A preparation that started an outline for a course the day needs leaves its ask to that outline;
 * otherwise it ends the ask, unless a newer request has replaced it.
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
    select: { id: true, kind: true, primaryCourseId: true, targetDate: true, timezone: true },
    where: { id: goalId },
  });

  if (!goal) {
    return;
  }

  const dayCourseIds = await loadDayStandInCourseIds({
    goal,
    localDate: getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
  });

  if (dayCourseIds.some((courseId) => startedCourseIds.includes(courseId))) {
    return;
  }

  await prisma.plan.updateMany({
    data: { lessonsAskedAt: null },
    where: { goalId, lessonsAskedAt: new Date(askedAt) },
  });
}
