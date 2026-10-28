import "server-only";
import { prisma } from "@zoonk/db";
import { getCourseCurriculumCacheTag, getLibraryChapterCacheTag } from "../../cache/tags";

/** Tag outlines by course: Next.js limits entries to 128 tags, fewer than a course may have chapters. */
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
