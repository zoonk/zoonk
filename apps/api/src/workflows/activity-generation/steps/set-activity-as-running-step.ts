import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";

export async function setActivityAsRunningStep(input: {
  activityId: bigint | number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setActivityAsRunning" });

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
      },
      select: { generationStatus: true, id: true },
      where: { id: input.activityId },
    }),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "setActivityAsRunning" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "setActivityAsRunning" });
}
