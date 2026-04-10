import { prisma } from "@zoonk/db";

/**
 * This step exists so failed regeneration runs do not leave unpublished draft
 * lessons behind. Draft lessons have no learner history yet, so hard delete is
 * the correct cleanup behavior here.
 */
export async function cleanupDraftLessonStep(input: { draftLessonId: number }): Promise<void> {
  "use step";

  await prisma.lesson.delete({
    where: { id: input.draftLessonId },
  });
}
