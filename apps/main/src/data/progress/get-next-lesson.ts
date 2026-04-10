import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type NextLesson = { id: number; needsGeneration: boolean };

/**
 * Given an activityId, finds the next lesson in course order.
 * Returns the lesson id and whether it still needs generation,
 * or null if no next lesson exists.
 *
 * `needsGeneration` is true when the lesson itself is pending/failed
 * or when any of its activities are pending/failed. This allows
 * callers to skip triggering the preload workflow when generation
 * is already complete or in progress.
 */
export async function getNextLesson(activityId: bigint): Promise<NextLesson | null> {
  const { data: activity, error } = await safeAsync(() =>
    prisma.activity.findFirst({
      include: {
        lesson: {
          include: { chapter: true },
        },
      },
      where: {
        archivedAt: null,
        id: activityId,
        lesson: {
          archivedAt: null,
          chapter: {
            archivedAt: null,
            course: { archivedAt: null },
          },
        },
      },
    }),
  );

  if (error || !activity) {
    return null;
  }

  const { lesson } = activity;
  const { chapter } = lesson;

  const { data: nextLesson } = await safeAsync(() =>
    prisma.lesson.findFirst({
      include: {
        _count: {
          select: {
            activities: {
              where: {
                archivedAt: null,
                generationStatus: { in: ["pending", "failed"] },
              },
            },
          },
        },
      },
      orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
      where: getPublishedLessonWhere({
        courseWhere: { id: chapter.courseId },
        lessonWhere: {
          OR: [
            {
              chapter: { id: chapter.id },
              position: { gt: lesson.position },
            },
            {
              chapter: { position: { gt: chapter.position } },
            },
          ],
        },
      }),
    }),
  );

  if (!nextLesson) {
    return null;
  }

  const needsGeneration =
    nextLesson.generationStatus === "pending" ||
    nextLesson.generationStatus === "failed" ||
    nextLesson._count.activities > 0;

  return { id: nextLesson.id, needsGeneration };
}
