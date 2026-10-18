import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getLibraryChapterCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { canViewLibraryRow, filterVisibleLibraryRows } from "../_utils/library-visibility";

async function getCachedLibraryChapter(chapterId: string) {
  "use cache";
  cacheTag(getLibraryChapterCacheTag(chapterId));

  const chapter = await prisma.chapter.findUnique({
    include: {
      homeCourse: { select: { id: true, language: true, slug: true, title: true } },
      lessons: {
        include: { lesson: { omit: { spec: true, summary: true } } },
        orderBy: { position: "asc" },
      },
    },
    where: { id: chapterId },
  });

  if (chapter) {
    cacheTag(...chapter.lessons.map((item) => getLibraryLessonCacheTag(item.lessonId)));
  }

  return chapter;
}

/**
 * Loads a chapter with its lessons in order, each with its generation status
 * so a chapter view can tell which lessons are ready. A private chapter, and
 * private lessons inside a shared chapter, are only returned to their owner.
 */
export async function getLibraryChapter({ chapterId }: { chapterId: string }) {
  if (!isUuid(chapterId)) {
    return null;
  }

  const chapter = await getCachedLibraryChapter(chapterId);

  if (!chapter || !(await canViewLibraryRow(chapter))) {
    return null;
  }

  const lessons = await filterVisibleLibraryRows(
    chapter.lessons.map((item) => ({ ...item.lesson, position: item.position })),
  );

  return { ...chapter, lessons };
}
