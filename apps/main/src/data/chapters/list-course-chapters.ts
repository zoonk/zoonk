import "server-only";
import { getCourseCurriculumCacheTag } from "@/data/cache-tags";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

/**
 * Shares the published course outline across catalog and player reads. Course
 * generation expires this entry when the workflow finishes adding chapters.
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
