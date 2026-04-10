import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { prisma } from "@zoonk/db";
import { retireLiveLesson } from "./_utils/retire-live-lesson";

/**
 * This step exists so the new lesson becomes live only after its replacement
 * content is fully ready. We always archive the previous live lesson before
 * moving the draft onto the public slug, which keeps regeneration predictable
 * and ensures learners never see a half-promoted state.
 */
export async function promoteRegeneratedLessonStep(input: {
  draftLessonId: number;
  liveLesson: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await prisma.$transaction(async (tx) => {
    await retireLiveLesson({ liveLesson: input.liveLesson, tx });

    await tx.lesson.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "completed",
        isPublished: input.liveLesson.isPublished,
        position: input.liveLesson.position,
        slug: input.liveLesson.slug,
      },
      where: { id: input.draftLessonId },
    });
  });
}
