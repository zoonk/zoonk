import { type ActivityStepName } from "@/workflows/config";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { type ActivityKind, prisma } from "@zoonk/db";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";

const kindToStepName: Partial<
  Record<
    ActivityKind,
    | "setBackgroundAsCompleted"
    | "setExplanationAsCompleted"
    | "setMechanicsAsCompleted"
    | "setQuizAsCompleted"
  >
> = {
  background: "setBackgroundAsCompleted",
  explanation: "setExplanationAsCompleted",
  mechanics: "setMechanicsAsCompleted",
  quiz: "setQuizAsCompleted",
};

async function setActivityAsCompletedBase(
  input: { activityId: bigint; workflowRunId: string },
  stepName: ActivityStepName,
): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: stepName });

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
    await streamStatus({ status: "error", step: stepName });
    throw error;
  }

  await revalidateMainApp([cacheTagActivity({ activityId: input.activityId })]);

  await streamStatus({ status: "completed", step: stepName });
}

export async function setActivityAsCompletedStep(
  input: { activityId: bigint; workflowRunId: string },
  kind: ActivityKind,
): Promise<void> {
  "use step";

  const stepName = kindToStepName[kind];

  // Unsupported activity kinds should not reach this point in the workflow.
  // If they do, skip silently - the activity was already processed.
  if (!stepName) {
    return;
  }

  await setActivityAsCompletedBase(input, stepName);
}
