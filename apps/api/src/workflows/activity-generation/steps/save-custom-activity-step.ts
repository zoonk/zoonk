import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { buildStaticStepRecords } from "./_utils/build-static-step-records";
import { type ActivitySteps } from "./_utils/get-activity-steps";

/**
 * Persists all generated data for a single custom activity in one batch:
 * readable steps with embedded images plus the activity completion update.
 *
 * This is the single save point for the activity. All upstream generate steps
 * produce data only; this step writes everything to the database at once.
 */
export async function saveCustomActivityStep({
  activityId,
  contentSteps,
  images,
  workflowRunId,
}: {
  activityId: string;
  contentSteps: ActivitySteps;
  images: StepImage[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveCustomActivity" });

  const { data: stepRecords, error: buildError } = await safeAsync(async () =>
    buildStaticStepRecords({ activityId, images, steps: contentSteps }),
  );

  if (buildError || !stepRecords) {
    throw buildError ?? new Error("Failed to build custom step records");
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
    throw error;
  }

  await stream.status({ status: "completed", step: "saveCustomActivity" });
}
