import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type VisualRow } from "./generate-visuals-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Builds static step records from content data.
 * Static steps are placed at even positions (index * 2)
 * to leave room for visual steps at odd positions.
 */
function buildStaticStepRecords(activityId: number, steps: ActivitySteps) {
  return steps.map((step, index) => ({
    activityId,
    content: assertStepContent("static", {
      text: step.text,
      title: step.title,
      variant: "text",
    }),
    isPublished: true,
    kind: "static" as const,
    position: index * 2,
  }));
}

/**
 * Persists all generated data for a single explanation activity in one batch:
 * - Static content steps (at even positions)
 * - Visual steps with image URLs (at odd positions)
 * - Marks the activity as completed
 *
 * This is the single save point for an explanation entity.
 * All upstream generate steps (content, visuals, images) produce data only;
 * this step writes everything to the database at once.
 */
export async function saveExplanationActivityStep({
  activityId,
  completedRows,
  contentSteps,
  workflowRunId,
}: {
  activityId: number;
  completedRows: VisualRow[];
  contentSteps: ActivitySteps;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveExplanationActivity" });

  const staticRecords = buildStaticStepRecords(activityId, contentSteps);
  const allStepRecords = [...staticRecords, ...completedRows];

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: allStepRecords }),
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
