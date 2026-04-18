import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type PracticeScenario, type PracticeStep } from "./generate-practice-content-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Practice activities now open with a static scenario screen so the player can
 * reuse the generic static-step renderer instead of learning a practice-only
 * intro shape.
 */
function buildPracticeScenarioRecord({
  activityId,
  scenario,
}: {
  activityId: string;
  scenario: PracticeScenario;
}) {
  return {
    activityId,
    content: assertStepContent("static", {
      text: scenario.text,
      title: scenario.title,
      variant: "text" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: 0,
  };
}

/**
 * Practice questions stay as the existing `multipleChoice` core steps. Their
 * positions start after the static scenario so navigation and completion stay
 * aligned with the visible player order.
 */
function buildPracticeQuestionRecords({
  activityId,
  steps,
}: {
  activityId: string;
  steps: PracticeStep[];
}) {
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
      position: index + 1,
    };
  });
}

/**
 * Saving practice activity content needs one ordered record list because the DB
 * write happens through a single `createMany` call. Building the full list here
 * keeps the persistence order obvious: scenario first, then questions.
 */
function buildPracticeStepRecords({
  activityId,
  scenario,
  steps,
}: {
  activityId: string;
  scenario: PracticeScenario;
  steps: PracticeStep[];
}) {
  return [
    buildPracticeScenarioRecord({ activityId, scenario }),
    ...buildPracticeQuestionRecords({ activityId, steps }),
  ];
}

/**
 * Persists all practice step records and marks the activity as completed.
 *
 * This is the single save point for a practice entity.
 * The upstream `generatePracticeContentStep` produces data only.
 */
export async function savePracticeActivityStep({
  activityId,
  scenario,
  steps,
  title,
  workflowRunId,
}: {
  activityId: string;
  scenario: PracticeScenario;
  steps: PracticeStep[];
  title: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "savePracticeActivity" });

  const stepRecords = buildPracticeStepRecords({ activityId, scenario, steps });

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: stepRecords }),
      prisma.activity.update({
        data: { generationRunId: workflowRunId, generationStatus: "completed", title },
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
