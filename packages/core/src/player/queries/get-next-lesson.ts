import "server-only";
import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type NextLesson = { id: string; needsGeneration: boolean };

/**
 * Finds the next lesson in course order.
 * Returns the lesson id and whether it still needs generation,
 * or null if no next lesson exists.
 *
 * `needsGeneration` is true when the next lesson still needs content.
 */
export async function getNextLesson(lessonId: string): Promise<NextLesson | null> {
  const { data: lesson, error } = await safeAsync(() =>
    prisma.lesson.findFirst({
      include: {
        chapter: true,
      },
      where: {
        id: lessonId,
      },
    }),
  );

  if (error || !lesson) {
    return null;
  }

  const { chapter } = lesson;

  const { data: nextLesson } = await safeAsync(() =>
    prisma.lesson.findFirst({
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

  const lessonNeedsGeneration =
    nextLesson.generationStatus === "pending" || nextLesson.generationStatus === "failed";

  return { id: nextLesson.id, needsGeneration: lessonNeedsGeneration };
}
