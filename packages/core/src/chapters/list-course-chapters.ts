import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCurriculumCacheTag } from "../cache/tags";
import { getReadableCourseWhere } from "../courses/course-access";
import { OPTIONAL_LESSON_KINDS } from "../courses/learning-plan-contract";
import { getSession } from "../users/get-session";

/**
 * Returns the cached published outline for one course in authored order.
 * Published lesson counts let every app render the same curriculum without
 * duplicating the visibility rule or loading each chapter separately.
 */
export async function listCourseChapters({ courseId }: { courseId: string }) {
  "use cache: private";
  const session = await getSession();
  cacheTag(getCourseCurriculumCacheTag(courseId));

  return prisma.chapter.findMany({
    include: {
      _count: {
        select: {
          lessons: {
            where: {
              isPublished: true,
              kind: { notIn: [...OPTIONAL_LESSON_KINDS] },
              sourceLessonId: null,
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: getPublishedChapterWhere({
      chapterWhere: { courseId },
      courseWhere: getReadableCourseWhere(session?.user.id ?? null),
    }),
  });
}

export type CourseChapter = Awaited<ReturnType<typeof listCourseChapters>>[number];
