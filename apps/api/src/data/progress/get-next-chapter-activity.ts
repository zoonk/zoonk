import { prisma } from "@zoonk/db";
import { getNextChapterActivity as getNextChapterActivityQuery } from "@zoonk/db/next-activity/chapter";
import { safeAsync } from "@zoonk/utils/error";
import { type NextActivityResult } from "./get-next-course-activity";

export async function getNextChapterActivity(
  userId: number,
  chapterId: number,
): Promise<NextActivityResult> {
  const { data: rows } = await safeAsync(() =>
    prisma.$queryRawTyped(getNextChapterActivityQuery(userId, chapterId)),
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
    orderBy: [{ lesson: { position: "asc" } }, { position: "asc" }],
    where: {
      isPublished: true,
      lesson: {
        chapter: { id: chapterId, isPublished: true },
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
