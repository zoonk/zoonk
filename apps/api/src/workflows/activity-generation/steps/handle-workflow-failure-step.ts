import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

/**
 * Marks published activities left in "running" state by initial generation as
 * failed.
 *
 * Regeneration intentionally does not go through this path. Hidden replacement
 * activities belong to the outer lesson-regeneration workflow, which deletes
 * that temporary replacement set on failure instead of keeping failed rows
 * around.
 */
export async function handleWorkflowFailureStep(input: { lessonId: string }): Promise<void> {
  "use step";

  await safeAsync(() =>
    prisma.activity.updateMany({
      data: { generationStatus: "failed" },
      where: {
        archivedAt: null,
        generationStatus: "running",
        isPublished: true,
        lessonId: input.lessonId,
      },
    }),
  );

  await using stream = createStepStream<ActivityStepName>();
  await stream.error({ reason: "aiGenerationFailed", step: "workflowError" });
}
