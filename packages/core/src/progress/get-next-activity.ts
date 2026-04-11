import {
  type ActivityScope,
  type LastCompletedActivity,
  findLastCompleted,
} from "@zoonk/core/activities/last-completed";
import { getNextActivityInCourse } from "@zoonk/core/activities/next-in-course";
import { getPublishedActivityWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";
import { getNextActivityStateForUser } from "./get-next-activity-state";

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
          include: { chapter: { include: { course: { include: { organization: true } } } } },
        },
      },
      orderBy: [
        { lesson: { chapter: { position: "asc" } } },
        { lesson: { position: "asc" } },
        { position: "asc" },
      ],
      where: getScopeActivityWhere(scope),
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

  if (lastCompleted) {
    const next = await getNextActivityInCourse({
      activityPosition: lastCompleted.activityPosition,
      chapterId: lastCompleted.chapterId,
      chapterPosition: lastCompleted.chapterPosition,
      courseId: lastCompleted.courseId,
      lessonId: lastCompleted.lessonId,
      lessonPosition: lastCompleted.lessonPosition,
    });

    if (next && isWithinScope(next, scope, lastCompleted)) {
      const { data: completedChapter } = await safeAsync(() =>
        prisma.chapterCompletion.findUnique({
          where: {
            userChapterCompletion: {
              chapterId: next.chapterId,
              userId,
            },
          },
        }),
      );

      if (!completedChapter) {
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
    }
  }

  const state = await getNextActivityStateForUser({ scope, userId });

  if (!state) {
    return null;
  }

  if (state.completed) {
    const first = await findFirstActivity(scope);

    if (!first) {
      return null;
    }
  }

  return {
    activityPosition: state.activityPosition,
    brandSlug: state.brandSlug,
    canPrefetch: state.canPrefetch,
    chapterSlug: state.chapterSlug,
    completed: state.completed,
    courseSlug: state.courseSlug,
    hasStarted: state.hasStarted,
    lessonSlug: state.lessonSlug,
  };
}
