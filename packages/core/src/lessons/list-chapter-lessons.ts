import "server-only";
import { type Lesson, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getChapterLessonsCacheTag } from "../cache/tags";

/**
 * Returns one chapter's cached published lessons in authored order so every app
 * shares the same visibility, ordering, and invalidation behavior.
 */
export async function listChapterLessons({ chapterId }: { chapterId: string }): Promise<Lesson[]> {
  "use cache";
  cacheTag(getChapterLessonsCacheTag(chapterId));

  return prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: getPublishedLessonWhere({ lessonWhere: { chapterId } }),
  });
}
