import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

/**
 * Given an activityId, finds the next lesson in course order.
 * Returns the lessonId or null if no next lesson exists.
 */
export async function getNextLessonId(activityId: bigint): Promise<number | null> {
  const { data: activity, error } = await safeAsync(() =>
    prisma.activity.findUnique({
      select: {
        lesson: {
          select: {
            chapter: { select: { courseId: true, id: true, position: true } },
            id: true,
            position: true,
          },
        },
      },
      where: { id: activityId },
    }),
  );

  if (error || !activity) {
    return null;
  }

  const { lesson } = activity;
  const { chapter } = lesson;

  const { data: nextLesson } = await safeAsync(() =>
    prisma.lesson.findFirst({
      orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
      select: { id: true },
      where: {
        OR: [
          {
            chapter: { id: chapter.id },
            position: { gt: lesson.position },
          },
          {
            chapter: { position: { gt: chapter.position } },
          },
        ],
        chapter: {
          course: { id: chapter.courseId },
          isPublished: true,
        },
        isPublished: true,
      },
    }),
  );

  return nextLesson?.id ?? null;
}
