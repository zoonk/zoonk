import "server-only";
import { type ChapterLesson, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryChapterCacheTag } from "../../cache/tags";
import { assertPlacementVisibility } from "../_utils/placement-visibility";

/**
 * Places a shared lesson in a chapter's outline. Placing the same lesson again
 * moves it, so retried workflow steps stay idempotent.
 */
export async function attachLessonToChapter({
  chapterId,
  lessonId,
  position,
}: {
  chapterId: string;
  lessonId: string;
  position: number;
}): Promise<ChapterLesson> {
  const [chapter, lesson] = await Promise.all([
    prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } }),
    prisma.lesson.findUniqueOrThrow({
      select: { ownerId: true, visibility: true },
      where: { id: lessonId },
    }),
  ]);

  assertPlacementVisibility({ child: lesson, container: chapter });

  const placement = await prisma.chapterLesson.upsert({
    create: { chapterId, lessonId, position },
    update: { position },
    where: { chapterId_lessonId: { chapterId, lessonId } },
  });

  revalidateCacheTags([getLibraryChapterCacheTag(chapterId)]);

  return placement;
}
