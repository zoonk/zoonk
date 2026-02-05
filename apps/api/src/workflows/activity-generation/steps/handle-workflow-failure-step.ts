import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getWritable } from "workflow";

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

  const writable = getWritable<string>();
  const writer = writable.getWriter();

  try {
    await writer.write(`data: ${JSON.stringify({ status: "error", step: "workflowError" })}\n\n`);
  } finally {
    writer.releaseLock();
  }
}
