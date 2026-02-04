import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { prisma } from "@zoonk/db";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";

export async function setActivityAsCompletedStep(input: {
  activityId: bigint;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setActivityAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "completed",
      },
      select: { generationStatus: true, id: true },
      where: { id: input.activityId },
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "setActivityAsCompleted" });
    throw error;
  }

  await revalidateMainApp([cacheTagActivity({ activityId: input.activityId })]);

  await streamStatus({ status: "completed", step: "setActivityAsCompleted" });
}
