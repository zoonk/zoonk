import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { assertPlacementVisibility } from "../_utils/placement-visibility";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { getChapterCacheTags } from "../chapters/chapter-cache-tags";

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

  await writePlanInputs(async (tx) => {
    await lockPlanSourceWrite(tx, { chapterIds: [chapterId], lessonIds });
    await tx.chapterLesson.deleteMany({ where: { chapterId } });

    await tx.chapterLesson.createMany({
      data: lessonIds.map((lessonId, position) => ({ chapterId, lessonId, position })),
    });
  });

  await revalidateCourseContent(await getChapterCacheTags(chapterId));
}
