import { prisma } from "@zoonk/db";
import { getNextCourseActivity as getNextCourseActivityQuery } from "@zoonk/db/next-activity/course";
import { safeAsync } from "@zoonk/utils/error";

export type NextActivityResult = {
  activityPosition: number;
  brandSlug: string;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
  lessonSlug: string;
} | null;

export async function getNextCourseActivity(
  userId: number,
  courseId: number,
): Promise<NextActivityResult> {
  const { data: rows } = await safeAsync(() =>
    prisma.$queryRawTyped(getNextCourseActivityQuery(userId, courseId)),
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
    orderBy: [
      { lesson: { chapter: { position: "asc" } } },
      { lesson: { position: "asc" } },
      { position: "asc" },
    ],
    where: {
      isPublished: true,
      lesson: {
        chapter: { courseId, isPublished: true },
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
