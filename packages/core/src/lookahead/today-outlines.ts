import { type GenerationStatus, prisma } from "@zoonk/db";
import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { OUTLINING, loadDayStandInCourseIds } from "../sessions/_utils/outlining-stand-ins";
import { getOutlineStaleBefore } from "./outline-ahead";

export type OutlineAsk = { courseId: string; status: GenerationStatus | null };

function isOutlining(status: GenerationStatus | null): boolean {
  return status !== null && OUTLINING.includes(status);
}

async function markOutlinesAsked({
  courseIds,
  now,
}: {
  courseIds: readonly string[];
  now: Date;
}): Promise<OutlineAsk[]> {
  if (courseIds.length === 0) {
    return [];
  }

  const askable = {
    OR: [
      { outlineStatus: null },
      { outlineStatus: { notIn: OUTLINING } },
      { updatedAt: { lt: getOutlineStaleBefore(now) } },
    ],
  };

  const asked = await prisma.course.findMany({
    select: { id: true, outlineStatus: true },
    where: { ...askable, id: { in: [...courseIds] } },
  });

  await prisma.course.updateMany({
    data: { outlineStatus: "pending", updatedAt: now },
    where: { ...askable, id: { in: asked.map((course) => course.id) } },
  });

  return asked.map((course) => ({ courseId: course.id, status: course.outlineStatus }));
}

/**
 * The learner is about to look at the day: its stand-ins' courses await their outlines at once,
 * until preparation settles which of them it outlines. Authorize the goal first.
 */
export async function askTodayOutlines({
  goalId,
  now = new Date(),
  timeZone,
}: {
  goalId: string;
  now?: Date;
  timeZone: string;
}): Promise<OutlineAsk[]> {
  const goal = await prisma.goal.findUnique({
    select: { id: true, kind: true, primaryCourseId: true, targetDate: true },
    where: { id: goalId },
  });

  if (!goal) {
    return [];
  }

  const courseIds = await loadDayStandInCourseIds({
    goal,
    localDate: getDateInTimeZone({ date: now, timeZone }),
  });

  return markOutlinesAsked({ courseIds, now });
}

/**
 * Courses whose outlines preparation starts read as awaiting until those outlines claim them; the
 * ones it asked for and didn't start go back to what they were, so nothing waits on them. An ask
 * that had gone stale goes back as failed, so it doesn't read as freshly outlining.
 */
export async function settleOutlineAsks({
  asked,
  now = new Date(),
  started,
}: {
  asked: readonly OutlineAsk[];
  now?: Date;
  started: readonly string[];
}): Promise<void> {
  const skipped = asked.filter((ask) => !started.includes(ask.courseId));

  await Promise.all([
    markOutlinesAsked({ courseIds: started, now }),
    ...skipped.map((ask) =>
      prisma.course.updateMany({
        data: { outlineStatus: isOutlining(ask.status) ? "failed" : ask.status },
        where: { id: ask.courseId, outlineStatus: "pending" },
      }),
    ),
  ]);
}
