import { prisma } from "@zoonk/db";
import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { addDays } from "../plans/planner/plan-calendar";
import { OUTLINING, loadDayStandInCourseIds } from "../sessions/_utils/outlining-stand-ins";
import { getLearnerTier, getLookahead } from "./learner-lookahead";
import { getOutlineStaleBefore } from "./outline-ahead";

/**
 * Preparation is about to start: the courses of the day's stand-ins it will outline await their
 * outlines at once, so a read before an outline claims its course says the lessons are coming.
 * An outline that finds nothing to write puts its course back. Authorize the goal first.
 */
export async function askTodayOutlines({
  goalId,
  now = new Date(),
  timeZone,
}: {
  goalId: string;
  now?: Date;
  timeZone: string;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({
    select: { id: true, kind: true, primaryCourseId: true, targetDate: true, userId: true },
    where: { id: goalId },
  });

  if (!goal) {
    return;
  }

  const localDate = getDateInTimeZone({ date: now, timeZone });
  const { outlineDays } = getLookahead(await getLearnerTier(goal.userId));

  const courseIds = await loadDayStandInCourseIds({
    goal,
    localDate,
    until: addDays(localDate, outlineDays),
  });

  await prisma.course.updateMany({
    data: { outlineStatus: "pending", updatedAt: now },
    where: {
      OR: [
        { outlineStatus: null },
        { outlineStatus: { notIn: OUTLINING } },
        { updatedAt: { lt: getOutlineStaleBefore(now) } },
      ],
      id: { in: courseIds },
    },
  });
}
