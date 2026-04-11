import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { getTargetLessonGenerationVersion } from "@zoonk/core/content/management";
import { prisma } from "@zoonk/db";

/**
 * Regeneration keeps the lesson row stable and only swaps its activity set.
 * Promotion therefore archives the current published activities, publishes the
 * hidden replacement activities, and then marks the live lesson as current
 * again.
 */
export async function promoteRegeneratedLessonStep(input: {
  liveLesson: LessonContext;
}): Promise<void> {
  "use step";

  await prisma.$transaction(async (tx) => {
    const archivedAt = new Date();

    await tx.activity.updateMany({
      data: {
        archivedAt,
        isPublished: false,
      },
      where: {
        archivedAt: null,
        isPublished: true,
        lessonId: input.liveLesson.id,
      },
    });

    await tx.activity.updateMany({
      data: {
        isPublished: true,
      },
      where: {
        archivedAt: null,
        isPublished: false,
        lessonId: input.liveLesson.id,
      },
    });

    await tx.lesson.update({
      data: {
        generationStatus: "completed",
        generationVersion: getTargetLessonGenerationVersion(input.liveLesson.kind),
        isRegenerating: false,
      },
      where: { id: input.liveLesson.id },
    });
  });
}
