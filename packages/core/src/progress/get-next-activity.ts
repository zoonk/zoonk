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
  canPrefetch: boolean;
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
    canPrefetch: activity.generationStatus === "completed",
    chapterSlug: activity.lesson.chapter.slug,
    courseSlug: activity.lesson.chapter.course.slug,
    lessonSlug: activity.lesson.slug,
  };
}

async function findFirstPendingLesson(scope: ActivityScope) {
  const chapterFilter = (() => {
    if ("courseId" in scope) {
      return { courseId: scope.courseId, isPublished: true };
    }

    if ("chapterId" in scope) {
      return { id: scope.chapterId, isPublished: true };
    }

    return { isPublished: true };
  })();

  const lessonIdFilter = "lessonId" in scope ? { id: scope.lessonId } : {};

  const { data: lesson, error } = await safeAsync(() =>
    prisma.lesson.findFirst({
      include: {
        chapter: {
          include: {
            course: { include: { organization: true } },
          },
        },
      },
      orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
      where: {
        ...lessonIdFilter,
        OR: [
          { generationStatus: { not: "completed" } },
          {
            activities: {
              some: {
                generationStatus: { not: "completed" },
                isPublished: true,
              },
            },
          },
        ],
        chapter: chapterFilter,
        isPublished: true,
      },
    }),
  );

  if (error || !lesson) {
    return null;
  }

  return {
    activityPosition: 0,
    brandSlug: lesson.chapter.course.organization?.slug ?? null,
    canPrefetch: false,
    chapterSlug: lesson.chapter.slug,
    courseSlug: lesson.chapter.course.slug,
    lessonSlug: lesson.slug,
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
  canPrefetch: boolean;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
  lessonSlug: string;
} | null> {
  const session = await getSession(headers);
  const userId = session ? Number(session.user.id) : 0;

  if (userId === 0) {
    const first = await findFirstActivity(scope);
    return first ? { ...first, completed: false, hasStarted: false } : null;
  }

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
      canPrefetch: true,
      chapterSlug: next.chapterSlug,
      completed: false,
      courseSlug: lastCompleted.courseSlug,
      hasStarted: true,
      lessonSlug: next.lessonSlug,
    };
  }

  const pending = await findFirstPendingLesson(scope);

  if (pending) {
    return { ...pending, completed: false, hasStarted: true };
  }

  const first = await findFirstActivity(scope);
  return first ? { ...first, completed: true, hasStarted: true } : null;
}
