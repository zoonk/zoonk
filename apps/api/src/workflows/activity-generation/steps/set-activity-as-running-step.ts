import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function setActivityAsRunningStep(input: {
  activityId: bigint | number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "setActivityAsRunning" });

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
      },
      where: { id: input.activityId },
    }),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "setActivityAsRunning" });
    throw error;
  }

  await stream.status({ status: "completed", step: "setActivityAsRunning" });
}
