import { streamError } from "@/workflows/_shared/stream-error";
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
      data: { generationStatus: "failed" },
      where: {
        generationRunId: workflowRunId,
        generationStatus: "running",
        lessonId,
      },
    }),
  );

  await streamError({ reason: "aiGenerationFailed", step: "workflowError" });
}
