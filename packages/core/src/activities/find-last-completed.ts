import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export type ActivityScope = { courseId: number } | { chapterId: number } | { lessonId: number };

export type LastCompletedActivity = {
  activityPosition: number;
  chapterId: number;
  chapterPosition: number;
  chapterSlug: string;
  courseId: number;
  courseSlug: string;
  lessonId: number;
  lessonPosition: number;
  lessonSlug: string;
  orgSlug: string | null;
};

function scopeFilter(scope: ActivityScope) {
  if ("courseId" in scope) {
    return {
      lesson: { chapter: { courseId: scope.courseId, isPublished: true }, isPublished: true },
    };
  }

  if ("chapterId" in scope) {
    return {
      lesson: { chapter: { isPublished: true }, chapterId: scope.chapterId, isPublished: true },
    };
  }

  return {
    lesson: { chapter: { isPublished: true }, isPublished: true },
    lessonId: scope.lessonId,
  };
}

/**
 * Finds the user's most recently completed activity in a scope.
 * Returns position info needed for `getNextActivityInCourse` + slugs for the API response.
 */
export async function findLastCompleted(
  userId: number,
  scope: ActivityScope,
): Promise<LastCompletedActivity | null> {
  const { data: progress, error } = await safeAsync(() =>
    prisma.activityProgress.findFirst({
      orderBy: [
        { completedAt: "desc" },
        { activity: { lesson: { chapter: { position: "desc" } } } },
        { activity: { lesson: { position: "desc" } } },
        { activity: { position: "desc" } },
      ],
      select: {
        activity: {
          select: {
            lesson: {
              select: {
                chapter: {
                  select: {
                    course: {
                      select: {
                        id: true,
                        organization: { select: { slug: true } },
                        slug: true,
                      },
                    },
                    id: true,
                    position: true,
                    slug: true,
                  },
                },
                id: true,
                position: true,
                slug: true,
              },
            },
            position: true,
          },
        },
      },
      where: {
        activity: {
          isPublished: true,
          ...scopeFilter(scope),
        },
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
