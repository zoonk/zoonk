import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getChapterCacheTag, getCourseCacheTag } from "../cache/tags";

/**
 * Loads one published chapter by its stable resource ID while enforcing the
 * parent course's public brand boundary. Including the course identity gives
 * non-web clients enough context to navigate the curriculum without another
 * lookup.
 */
export async function getChapterById({ chapterId }: { chapterId: string }) {
  "use cache";

  cacheTag(getChapterCacheTag(chapterId));

  const chapter = await prisma.chapter.findFirst({
    include: { course: true },
    where: getPublishedChapterWhere({
      chapterWhere: { id: chapterId },
      courseWhere: { organization: { kind: "brand" } },
    }),
  });

  if (chapter) {
    cacheTag(getCourseCacheTag(chapter.courseId));
  }

  return chapter;
}
