import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityChallengeSchema } from "@zoonk/ai/tasks/activities/core/challenge";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Builds the full set of challenge step records: intro, decision steps, and reflection.
 * The intro and reflection are static text steps; decision steps are multipleChoice
 * with `kind: "challenge"`.
 */
function buildChallengeStepRecords(activityId: number, data: ActivityChallengeSchema) {
  const introStep = {
    activityId,
    content: assertStepContent("static", { text: data.intro, title: "", variant: "text" }),
    isPublished: true,
    kind: "static" as const,
    position: 0,
  };

  const mcSteps = data.steps.map((step, index) => ({
    activityId,
    content: assertStepContent("multipleChoice", {
      context: step.context,
      kind: "challenge",
      options: step.options,
      question: step.question,
    }),
    isPublished: true,
    kind: "multipleChoice" as const,
    position: index + 1,
  }));

  const reflectionStep = {
    activityId,
    content: assertStepContent("static", { text: data.reflection, title: "", variant: "text" }),
    isPublished: true,
    kind: "static" as const,
    position: data.steps.length + 1,
  };

  return [introStep, ...mcSteps, reflectionStep];
}

/**
 * Persists all challenge step records (intro + decision steps + reflection)
 * and marks the activity as completed.
 *
 * This is the single save point for a challenge entity.
 * The upstream `generateChallengeContentStep` produces data only.
 */
export async function saveChallengeActivityStep({
  activityId,
  data,
  workflowRunId,
}: {
  activityId: number;
  data: ActivityChallengeSchema;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "saveChallengeActivity" });

  const stepRecords = buildChallengeStepRecords(activityId, data);

  const { error: saveError } = await safeAsync(() => prisma.step.createMany({ data: stepRecords }));

  if (saveError) {
    await stream.error({ reason: "dbSaveFailed", step: "saveChallengeActivity" });
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
    await stream.error({ reason: "dbSaveFailed", step: "saveChallengeActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  await stream.status({ status: "completed", step: "saveChallengeActivity" });
}
