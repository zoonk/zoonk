import { prisma } from "@zoonk/db";

/**
 * Marks the generated intro chapter complete after its lesson rows exist. The
 * intro chapter is not processed by the normal chapter-generation workflow, so
 * it needs this small course-setup step instead of a workflow run id from
 * chapter generation.
 */
export async function completeIntroductionChapterStep(chapterId: string): Promise<void> {
  "use step";

  await prisma.chapter.update({
    data: { generationStatus: "completed" },
    where: { id: chapterId },
  });
}
