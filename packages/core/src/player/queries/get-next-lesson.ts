import "server-only";
import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type NextLesson = { id: string; needsGeneration: boolean };

/**
 * Given an activityId, finds the next lesson in course order.
 * Returns the lesson id and whether it still needs generation,
 * or null if no next lesson exists.
 *
 * `needsGeneration` is true when the next lesson still needs its initial
 * generation work or has descendant activities still generating.
 */
export async function getNextLesson(activityId: string): Promise<NextLesson | null> {
  const { data: activity, error } = await safeAsync(() =>
    prisma.activity.findFirst({
      include: {
        lesson: {
          include: { chapter: true },
        },
      },
      where: {
        id: activityId,
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
                generationStatus: { in: ["pending", "failed"] },
                isPublished: true,
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

  const hasActivitiesAwaitingGeneration = nextLesson._count.activities > 0;
  const lessonNeedsGeneration =
    nextLesson.generationStatus === "pending" || nextLesson.generationStatus === "failed";

  const needsGeneration = lessonNeedsGeneration || hasActivitiesAwaitingGeneration;

  return { id: nextLesson.id, needsGeneration };
}
