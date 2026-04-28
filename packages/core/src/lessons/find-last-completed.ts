import "server-only";
import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export type LessonScope = { courseId: string } | { chapterId: string } | { lessonId: string };

type LastCompletedLesson = {
  chapterId: string;
  chapterPosition: number;
  chapterSlug: string;
  courseId: string;
  courseSlug: string;
  lessonId: string;
  lessonPosition: number;
  lessonSlug: string;
  orgSlug: string | null;
};

/**
 * Builds the published lesson filter for the requested curriculum scope.
 */
function getScopeLessonWhere(scope: LessonScope) {
  if ("courseId" in scope) {
    return getPublishedLessonWhere({
      courseWhere: { id: scope.courseId },
    });
  }

  if ("chapterId" in scope) {
    return getPublishedLessonWhere({
      chapterWhere: { id: scope.chapterId },
    });
  }

  return getPublishedLessonWhere({
    lessonWhere: { id: scope.lessonId },
  });
}

/**
 * Finds the user's most recently completed lesson in a scope and returns the
 * position data needed to locate the next lesson in course order.
 */
export async function findLastCompleted(
  userId: string,
  scope: LessonScope,
): Promise<LastCompletedLesson | null> {
  const { data: progress, error } = await safeAsync(() =>
    prisma.lessonProgress.findFirst({
      include: {
        lesson: {
          include: {
            chapter: {
              include: {
                course: { include: { organization: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { completedAt: "desc" },
        { lesson: { chapter: { position: "desc" } } },
        { lesson: { position: "desc" } },
      ],
      where: {
        completedAt: { not: null },
        lesson: getScopeLessonWhere(scope),
        userId,
      },
    }),
  );

  if (error || !progress) {
    return null;
  }

  const { lesson } = progress;
  const { chapter } = lesson;

  return {
    chapterId: chapter.id,
    chapterPosition: chapter.position,
    chapterSlug: chapter.slug,
    courseId: chapter.course.id,
    courseSlug: chapter.course.slug,
    lessonId: lesson.id,
    lessonPosition: lesson.position,
    lessonSlug: lesson.slug,
    orgSlug: chapter.course.organization?.slug ?? null,
  };
}
