import { prisma } from "@zoonk/db";

/**
 * This step exists so failed regeneration runs do not leave unpublished draft
 * lessons behind. Draft lessons have no learner history yet, so hard delete is
 * the correct cleanup behavior here. The cleanup must also be idempotent so a
 * retry cannot mask the original regeneration error just because the draft was
 * already removed on an earlier pass.
 */
export async function cleanupDraftLessonStep(input: { draftLessonId: number }): Promise<void> {
  "use step";

  await prisma.lesson.deleteMany({
    where: { id: input.draftLessonId },
  });
}
