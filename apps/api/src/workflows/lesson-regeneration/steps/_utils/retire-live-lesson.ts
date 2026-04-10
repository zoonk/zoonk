import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { getContentDeleteDecision } from "@zoonk/core/content/lifecycle";
import { type TransactionClient } from "@zoonk/db";

/**
 * Archived lessons keep their learner history rows, so they need a unique slug
 * before the public slug can disappear or move elsewhere. The lesson ID makes
 * the archived slug deterministic, which avoids collisions if retries touch the
 * same lesson more than once.
 */
function getArchivedLessonSlug(input: { lessonId: number; slug: string }) {
  return `${input.slug}-archived-${input.lessonId}`;
}

/**
 * This helper exists so every regeneration outcome uses the same lifecycle
 * policy for the live lesson. Promotion and safety-filter removal both need to
 * archive learner-touched lessons and hard-delete untouched lessons, and this
 * keeps that rule in one place instead of duplicating it in multiple steps.
 */
export async function retireLiveLesson(input: {
  liveLesson: LessonContext;
  tx: TransactionClient;
}): Promise<void> {
  const deleteDecision = await getContentDeleteDecision({
    entityType: "lesson",
    lesson: { id: input.liveLesson.id },
  });

  if (deleteDecision.mode === "archive") {
    await input.tx.lesson.update({
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

    return;
  }

  await input.tx.lesson.delete({
    where: { id: input.liveLesson.id },
  });
}
