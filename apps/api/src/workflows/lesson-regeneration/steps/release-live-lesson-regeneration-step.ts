import { prisma } from "@zoonk/db";

/**
 * Regeneration claims a live lesson by flipping an explicit boolean on that
 * row. When the refresh finishes or fails, we need one shared way to release
 * that claim without changing freshness metadata. Keeping version updates out
 * of this step ensures only a successful promotion can mark regenerated
 * content as current.
 */
export async function releaseLiveLessonRegenerationStep(input: {
  lessonId: number;
}): Promise<void> {
  "use step";

  await prisma.lesson.update({
    data: {
      generationStatus: "completed",
      isRegenerating: false,
    },
    where: { id: input.lessonId },
  });
}
