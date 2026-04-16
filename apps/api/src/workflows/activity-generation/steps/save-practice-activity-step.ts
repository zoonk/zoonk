import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type PracticeStep } from "./generate-practice-content-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Builds multipleChoice step records from practice steps.
 * Each practice step becomes a multipleChoice step with `kind: "core"`.
 */
function buildPracticeStepRecords(activityId: string, steps: PracticeStep[]) {
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
  activityId: string;
  steps: PracticeStep[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "savePracticeActivity" });

  const stepRecords = buildPracticeStepRecords(activityId, steps);

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
    await stream.error({ reason: "dbSaveFailed", step: "savePracticeActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  await stream.status({ status: "completed", step: "savePracticeActivity" });
}
