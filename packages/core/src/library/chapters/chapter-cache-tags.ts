import "server-only";
import { prisma } from "@zoonk/db";
import { getCourseCurriculumCacheTag, getLibraryChapterCacheTag } from "../../cache/tags";

/**
 * Every cached view a shared chapter's change must refresh: the chapter's own and the outlines of
 * the courses that place it. A course outline is tagged by its course, not by each chapter, since
 * a cache entry carries at most 128 tags and a subject's course can hold more chapters than that.
 */
export async function getChapterCacheTags(chapterId: string): Promise<string[]> {
  const placements = await prisma.courseChapter.findMany({
    select: { courseId: true },
    where: { chapterId },
  });

  return [
    getLibraryChapterCacheTag(chapterId),
    ...placements.map((placement) => getCourseCurriculumCacheTag(placement.courseId)),
  ];
}
