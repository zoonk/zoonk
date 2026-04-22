import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { buildStaticStepRecords } from "./_utils/build-static-step-records";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Persists explanation activity steps and their embedded images in one
 * transaction, then marks the activity as completed. Upstream steps only
 * produce structured data; this is the single write point that turns it into
 * real DB rows.
 */
export async function saveExplanationActivityStep({
  activityId,
  images,
  steps,
  workflowRunId,
}: {
  activityId: string;
  images: StepImage[];
  steps: ActivitySteps;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveExplanationActivity" });

  const { data: stepRecords, error: buildError } = await safeAsync(async () =>
    buildStaticStepRecords({ activityId, images, steps }),
  );

  if (buildError || !stepRecords) {
    await stream.error({ reason: "dbSaveFailed", step: "saveExplanationActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: stepRecords }),
      prisma.activity.update({
        data: { generationRunId: workflowRunId, generationStatus: "completed" },
        where: { id: activityId },
      }),
    ]),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "saveExplanationActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  await stream.status({ status: "completed", step: "saveExplanationActivity" });
}
