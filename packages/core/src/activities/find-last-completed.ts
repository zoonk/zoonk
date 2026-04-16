import "server-only";
import { getPublishedActivityWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export type ActivityScope = { courseId: string } | { chapterId: string } | { lessonId: string };

type LastCompletedActivity = {
  activityPosition: number;
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

function getScopeActivityWhere(scope: ActivityScope) {
  if ("courseId" in scope) {
    return getPublishedActivityWhere({
      courseWhere: { id: scope.courseId },
    });
  }

  if ("chapterId" in scope) {
    return getPublishedActivityWhere({
      chapterWhere: { id: scope.chapterId },
    });
  }

  return getPublishedActivityWhere({
    lessonWhere: { id: scope.lessonId },
  });
}

/**
 * Finds the user's most recently completed activity in a scope.
 * Returns position info needed for `getNextActivityInCourse` + slugs for the API response.
 */
export async function findLastCompleted(
  userId: string,
  scope: ActivityScope,
): Promise<LastCompletedActivity | null> {
  const { data: progress, error } = await safeAsync(() =>
    prisma.activityProgress.findFirst({
      include: {
        activity: {
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
        },
      },
      orderBy: [
        { completedAt: "desc" },
        { activity: { lesson: { chapter: { position: "desc" } } } },
        { activity: { lesson: { position: "desc" } } },
        { activity: { position: "desc" } },
      ],
      where: {
        activity: getScopeActivityWhere(scope),
        completedAt: { not: null },
        userId,
      },
    }),
  );

  if (error || !progress) {
    return null;
  }

  const { activity } = progress;
  const { lesson } = activity;
  const { chapter } = lesson;

  return {
    activityPosition: activity.position,
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
