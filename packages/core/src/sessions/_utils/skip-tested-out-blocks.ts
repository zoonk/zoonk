import "server-only";
import { type StudySessionStatus, prisma } from "@zoonk/db";

/** A day that ended keeps what happened in it; days still running or ahead move on. */
const OPEN_SESSION_STATUSES: StudySessionStatus[] = ["planned", "active"];

/**
 * The lessons some plan items teach: a lesson item's own, and a chapter item's chapter lessons,
 * since a day takes the chapter's next lesson for it.
 */
async function loadItemLessonIds(planItemIds: readonly string[]): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    select: { chapterId: true, lessonId: true },
    where: { id: { in: [...planItemIds] } },
  });

  const chapterIds = items.flatMap((item) => (item.lessonId ? [] : (item.chapterId ?? [])));

  const chapterLessons =
    chapterIds.length > 0
      ? await prisma.chapterLesson.findMany({
          select: { lessonId: true },
          where: { chapterId: { in: chapterIds } },
        })
      : [];

  return [
    ...new Set([
      ...items.flatMap((item) => item.lessonId ?? []),
      ...chapterLessons.map((row) => row.lessonId),
    ]),
  ];
}

/**
 * A test-out or placement settled some lessons: the one the learner has open on an open day is
 * skipped, so Today goes on with the next stop instead of restarting a lesson they just showed
 * they know. The ones not started leave with the rest of the day's not-started part, which follows
 * the plan (see `followPlanToday`).
 */
export async function skipTestedOutBlocks({
  goalId,
  planItemIds,
}: {
  goalId: string;
  planItemIds: readonly string[];
}): Promise<void> {
  const lessonIds = await loadItemLessonIds(planItemIds);

  if (lessonIds.length === 0) {
    return;
  }

  await prisma.studySessionBlock.updateMany({
    data: { status: "skipped" },
    where: {
      kind: "learn",
      lessonId: { in: lessonIds },
      session: { goalId, status: { in: OPEN_SESSION_STATUSES } },
      status: "active",
    },
  });
}
