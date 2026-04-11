import { prisma } from "@zoonk/db";

/**
 * Regeneration builds an unpublished replacement activity set under the live
 * lesson. On failure, retry, or successful promotion we need one idempotent
 * cleanup path that drops only the hidden unpublished activities and leaves
 * the published learner-facing activities untouched. Regeneration is already
 * serialized at the lesson level, so we do not need a workflow run id here.
 */
export async function cleanupRegeneratedActivitiesStep(input: { lessonId: number }): Promise<void> {
  "use step";

  await prisma.activity.deleteMany({
    where: {
      archivedAt: null,
      isPublished: false,
      lessonId: input.lessonId,
    },
  });
}
