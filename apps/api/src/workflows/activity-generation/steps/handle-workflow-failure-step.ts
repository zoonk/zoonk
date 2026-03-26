import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

/**
 * Marks activities left in "running" state by this workflow as failed.
 * Completed activities stay completed, pending ones stay pending.
 * Streams an error event so the frontend shows retry UI.
 */
export async function handleWorkflowFailureStep(
  lessonId: number,
  workflowRunId: string,
): Promise<void> {
  "use step";

  await safeAsync(() =>
    prisma.activity.updateMany({
      data: { generationRunId: null, generationStatus: "failed" },
      where: {
        generationRunId: workflowRunId,
        generationStatus: "running",
        lessonId,
      },
    }),
  );

  await using stream = createStepStream<ActivityStepName>();
  await stream.error({ reason: "aiGenerationFailed", step: "workflowError" });
}
