import "server-only";
import { getChapterLessonsCacheTag } from "@/data/cache-tags";
import { type Lesson, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

/**
 * Shares a chapter's published lessons across catalog and player reads. Chapter
 * and lesson generation expire this entry after adding new lesson rows.
 */
export async function listChapterLessons({ chapterId }: { chapterId: string }): Promise<Lesson[]> {
  "use cache";
  cacheTag(getChapterLessonsCacheTag(chapterId));

  return prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: getPublishedLessonWhere({ lessonWhere: { chapterId } }),
  });
}
