import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type PracticeStep } from "./generate-practice-content-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Builds multipleChoice step records from practice steps.
 * Each practice step becomes a multipleChoice step with `kind: "core"`.
 */
function buildPracticeStepRecords(activityId: number, steps: PracticeStep[]) {
  return steps.map((step, index) => {
    const content = assertStepContent("multipleChoice", {
      context: step.context,
      kind: "core",
      options: step.options,
      question: step.question,
    });

    return {
      activityId,
      content,
      isPublished: true,
      kind: "multipleChoice" as const,
      position: index,
    };
  });
}

/**
 * Persists all practice step records and marks the activity as completed.
 *
 * This is the single save point for a practice entity.
 * The upstream `generatePracticeContentStep` produces data only.
 */
export async function savePracticeActivityStep({
  activityId,
  steps,
  workflowRunId,
}: {
  activityId: number;
  steps: PracticeStep[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "savePracticeActivity" });

  const stepRecords = buildPracticeStepRecords(activityId, steps);

  const { error: saveError } = await safeAsync(() => prisma.step.createMany({ data: stepRecords }));

  if (saveError) {
    await stream.error({ reason: "dbSaveFailed", step: "savePracticeActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  const { error: completeError } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: activityId },
    }),
  );

  if (completeError) {
    await stream.error({ reason: "dbSaveFailed", step: "savePracticeActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  await stream.status({ status: "completed", step: "savePracticeActivity" });
}
