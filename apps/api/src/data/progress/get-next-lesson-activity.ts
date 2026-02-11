import { prisma } from "@zoonk/db";
import { getNextLessonActivity as getNextLessonActivityQuery } from "@zoonk/db/next-activity/lesson";
import { safeAsync } from "@zoonk/utils/error";
import { type NextActivityResult } from "./get-next-course-activity";

export async function getNextLessonActivity(
  userId: number,
  lessonId: number,
): Promise<NextActivityResult> {
  const { data: rows } = await safeAsync(() =>
    prisma.$queryRawTyped(getNextLessonActivityQuery(userId, lessonId)),
  );

  const row = rows?.[0];

  if (row) {
    return {
      activityPosition: row.activityPosition,
      brandSlug: row.orgSlug,
      chapterSlug: row.chapterSlug,
      completed: false,
      courseSlug: row.courseSlug,
      hasStarted: row.hasStarted ?? false,
      lessonSlug: row.lessonSlug,
    };
  }

  // All activities completed -- return the first activity for "Review"
  const firstActivity = await prisma.activity.findFirst({
    include: {
      lesson: {
        include: {
          chapter: {
            include: {
              course: {
                include: { organization: true },
              },
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: {
      isPublished: true,
      lesson: {
        chapter: { isPublished: true },
        id: lessonId,
        isPublished: true,
      },
    },
  });

  if (!firstActivity) {
    return null;
  }

  return {
    activityPosition: firstActivity.position,
    brandSlug: firstActivity.lesson.chapter.course.organization.slug,
    chapterSlug: firstActivity.lesson.chapter.slug,
    completed: true,
    courseSlug: firstActivity.lesson.chapter.course.slug,
    hasStarted: true,
    lessonSlug: firstActivity.lesson.slug,
  };
}
