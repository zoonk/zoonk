import { prisma } from "@zoonk/db";
import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { OUTLINING, loadDayStandInCourseIds } from "../sessions/_utils/outlining-stand-ins";
import { getOutlineStaleBefore } from "./outline-ahead";

/**
 * The learner asked for the day's lessons: its stand-ins' courses await their outlines at once, so
 * the next read says they're coming before preparation claims them. Authorize the goal first.
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
    select: { id: true, kind: true, primaryCourseId: true, targetDate: true },
    where: { id: goalId },
  });

  if (!goal) {
    return;
  }

  const courseIds = await loadDayStandInCourseIds({
    goal,
    localDate: getDateInTimeZone({ date: now, timeZone }),
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
