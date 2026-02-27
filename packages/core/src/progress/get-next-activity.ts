import {
  type ActivityScope,
  type LastCompletedActivity,
  findLastCompleted,
} from "@zoonk/core/activities/last-completed";
import { getNextActivityInCourse } from "@zoonk/core/activities/next-in-course";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";

function scopeWhere(scope: ActivityScope) {
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

async function findFirstActivity(scope: ActivityScope): Promise<{
  activityPosition: number;
  brandSlug: string | null;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
} | null> {
  const { data: activity, error } = await safeAsync(() =>
    prisma.activity.findFirst({
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
        { lesson: { chapter: { position: "asc" } } },
        { lesson: { position: "asc" } },
        { position: "asc" },
      ],
      where: { isPublished: true, ...scopeWhere(scope) },
    }),
  );

  if (error || !activity) {
    return null;
  }

  return {
    activityPosition: activity.position,
    brandSlug: activity.lesson.chapter.course.organization?.slug ?? null,
    chapterSlug: activity.lesson.chapter.slug,
    courseSlug: activity.lesson.chapter.course.slug,
    lessonSlug: activity.lesson.slug,
  };
}

function isWithinScope(
  next: { chapterSlug: string; lessonSlug: string },
  scope: ActivityScope,
  lastCompleted: LastCompletedActivity,
): boolean {
  if ("courseId" in scope) {
    return true;
  }

  if ("chapterId" in scope) {
    return next.chapterSlug === lastCompleted.chapterSlug;
  }

  return next.lessonSlug === lastCompleted.lessonSlug;
}

export async function getNextActivity({
  scope,
  headers,
}: {
  scope: ActivityScope;
  headers?: Headers;
}): Promise<{
  activityPosition: number;
  brandSlug: string | null;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
  lessonSlug: string;
} | null> {
  const session = await getSession(headers);
  const userId = session ? Number(session.user.id) : 0;

  const lastCompleted = await findLastCompleted(userId, scope);

  if (!lastCompleted) {
    const first = await findFirstActivity(scope);
    return first ? { ...first, completed: false, hasStarted: false } : null;
  }

  const next = await getNextActivityInCourse({
    activityPosition: lastCompleted.activityPosition,
    chapterId: lastCompleted.chapterId,
    chapterPosition: lastCompleted.chapterPosition,
    courseId: lastCompleted.courseId,
    lessonId: lastCompleted.lessonId,
    lessonPosition: lastCompleted.lessonPosition,
  });

  if (next && isWithinScope(next, scope, lastCompleted)) {
    return {
      activityPosition: next.activityPosition,
      brandSlug: lastCompleted.orgSlug,
      chapterSlug: next.chapterSlug,
      completed: false,
      courseSlug: lastCompleted.courseSlug,
      hasStarted: true,
      lessonSlug: next.lessonSlug,
    };
  }

  const first = await findFirstActivity(scope);
  return first ? { ...first, completed: true, hasStarted: true } : null;
}
