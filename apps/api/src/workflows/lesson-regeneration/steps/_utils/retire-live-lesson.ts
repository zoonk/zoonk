import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
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
 * policy for the live lesson. Regeneration is intentionally archive-only,
 * even when a lesson looks untouched, because the workflow is rare and the
 * simpler rule avoids archive-vs-delete races while keeping history intact.
 */
export async function retireLiveLesson(input: {
  liveLesson: LessonContext;
  tx: TransactionClient;
}): Promise<void> {
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
}
