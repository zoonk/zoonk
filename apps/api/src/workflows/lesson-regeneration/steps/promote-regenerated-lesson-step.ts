import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { getContentDeleteDecision } from "@zoonk/core/content/lifecycle";
import { prisma } from "@zoonk/db";

/**
 * Archived lessons keep their history rows, so they need a unique slug before
 * the replacement lesson can take over the public route. The old lesson ID is
 * enough to make repeated promotions deterministic and collision-free.
 */
function getArchivedLessonSlug(input: { lessonId: number; slug: string }) {
  return `${input.slug}-archived-${input.lessonId}`;
}

/**
 * This step exists so the new lesson becomes live only after its replacement
 * content is fully ready. We either archive or hard-delete the previous lesson
 * according to the lifecycle rules, then move the draft lesson onto the live
 * slug inside the same transaction so learners never see a half-promoted state.
 */
export async function promoteRegeneratedLessonStep(input: {
  draftLessonId: number;
  liveLesson: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  const deleteDecision = await getContentDeleteDecision({
    entityType: "lesson",
    lesson: { id: input.liveLesson.id },
  });

  await prisma.$transaction(async (tx) => {
    if (deleteDecision.mode === "archive") {
      await tx.lesson.update({
        data: {
          archivedAt: new Date(),
          generationRunId: null,
          generationStatus: "completed",
          isPublished: false,
          slug: getArchivedLessonSlug({
            lessonId: input.liveLesson.id,
            slug: input.liveLesson.slug,
          }),
        },
        where: { id: input.liveLesson.id },
      });
    } else {
      await tx.lesson.delete({
        where: { id: input.liveLesson.id },
      });
    }

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
