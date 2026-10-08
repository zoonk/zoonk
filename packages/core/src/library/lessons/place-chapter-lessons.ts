import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { assertPlacementVisibility } from "../_utils/placement-visibility";
import { getChapterCacheTags } from "../chapters/chapter-cache-tags";

/**
 * Makes these shared lessons a chapter's outline, in this order. Placements an earlier attempt
 * left are cleared first, so a retried workflow step ends with exactly this order.
 */
export async function placeChapterLessons({
  chapterId,
  lessonIds,
}: {
  chapterId: string;
  lessonIds: readonly string[];
}): Promise<void> {
  const [chapter, lessons] = await Promise.all([
    prisma.chapter.findUniqueOrThrow({
      select: { ownerId: true, visibility: true },
      where: { id: chapterId },
    }),
    prisma.lesson.findMany({
      select: { ownerId: true, visibility: true },
      where: { id: { in: [...lessonIds] } },
    }),
  ]);

  lessons.forEach((lesson) => assertPlacementVisibility({ child: lesson, container: chapter }));

  await prisma.chapterLesson.deleteMany({ where: { chapterId } });

  await prisma.chapterLesson.createMany({
    data: lessonIds.map((lessonId, position) => ({ chapterId, lessonId, position })),
  });

  revalidateCacheTags(await getChapterCacheTags(chapterId));
}
