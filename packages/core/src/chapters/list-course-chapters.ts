import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCurriculumCacheTag } from "../cache/tags";

/**
 * Returns the cached published outline for one course in authored order.
 * Published lesson counts let every app render the same curriculum without
 * duplicating the visibility rule or loading each chapter separately.
 */
export async function listCourseChapters({ courseId }: { courseId: string }) {
  "use cache";
  cacheTag(getCourseCurriculumCacheTag(courseId));

  return prisma.chapter.findMany({
    include: { _count: { select: { lessons: { where: { isPublished: true } } } } },
    orderBy: { position: "asc" },
    where: getPublishedChapterWhere({ chapterWhere: { courseId } }),
  });
}

export type CourseChapter = Awaited<ReturnType<typeof listCourseChapters>>[number];
