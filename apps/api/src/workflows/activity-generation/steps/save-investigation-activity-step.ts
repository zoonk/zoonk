import { randomUUID } from "node:crypto";
import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityInvestigationAccuracySchema } from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import { type ActivityInvestigationActionsSchema } from "@zoonk/ai/tasks/activities/core/investigation-actions";
import { type ActivityInvestigationFindingsSchema } from "@zoonk/ai/tasks/activities/core/investigation-findings";
import { type ActivityInvestigationScenarioSchema } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

/**
 * Zips scenario explanations with accuracy tiers and feedback
 * to produce the explanations array used in the call step.
 * Each explanation carries its own feedback message so the player
 * can show explanation-specific feedback after the learner commits.
 */
function buildExplanationsWithAccuracy(
  scenario: ActivityInvestigationScenarioSchema,
  accuracy: ActivityInvestigationAccuracySchema,
) {
  return scenario.explanations.map((text, index) => ({
    accuracy: accuracy.accuracies[index]?.accuracy ?? "wrong",
    feedback: accuracy.accuracies[index]?.feedback ?? "",
    id: randomUUID(),
    text,
  }));
}

/**
 * Builds the 3 step records for an investigation activity from AI outputs.
 *
 * - Position 0: investigation/problem — scenario
 * - Position 1: investigation/action — actions with embedded findings
 * - Position 2: investigation/call — explanations with accuracy and feedback
 */
function buildInvestigationStepRecords({
  accuracy,
  activityId,
  actions,
  findings,
  scenario,
}: {
  accuracy: ActivityInvestigationAccuracySchema;
  activityId: string;
  actions: ActivityInvestigationActionsSchema;
  findings: ActivityInvestigationFindingsSchema;
  scenario: ActivityInvestigationScenarioSchema;
}) {
  const explanations = buildExplanationsWithAccuracy(scenario, accuracy);

  const problemStep = {
    activityId,
    content: assertStepContent("investigation", {
      scenario: scenario.scenario,
      variant: "problem" as const,
    }),
    isPublished: true,
    kind: "investigation" as const,
    position: 0,
  };

  const actionStep = {
    activityId,
    content: assertStepContent("investigation", {
      actions: actions.actions.map((action, index) => ({
        finding: findings.findings[index] ?? "",
        id: randomUUID(),
        label: action.label,
        quality: action.quality,
      })),
      variant: "action" as const,
    }),
    isPublished: true,
    kind: "investigation" as const,
    position: 1,
  };

  const callStep = {
    activityId,
    content: assertStepContent("investigation", {
      explanations,
      variant: "call" as const,
    }),
    isPublished: true,
    kind: "investigation" as const,
    position: 2,
  };

  return [problemStep, actionStep, callStep];
}

/**
 * Persists all generated investigation data in one transaction:
 * - Problem step with scenario
 * - Action step with all investigation actions and embedded findings
 * - Call step with explanations and per-explanation feedback
 * - Marks the activity as completed
 *
 * This is the single save point for an investigation entity.
 * Upstream generate steps produce data only; this step writes
 * everything to the database at once.
 */
export async function saveInvestigationActivityStep({
  accuracy,
  activityId,
  actions,
  findings,
  scenario,
  title,
  workflowRunId,
}: {
  accuracy: ActivityInvestigationAccuracySchema;
  activityId: string;
  actions: ActivityInvestigationActionsSchema;
  findings: ActivityInvestigationFindingsSchema;
  scenario: ActivityInvestigationScenarioSchema;
  title: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveInvestigationActivity" });

  const stepRecords = buildInvestigationStepRecords({
    accuracy,
    actions,
    activityId,
    findings,
    scenario,
  });

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
    throw error;
  }

  await stream.status({ status: "completed", step: "saveInvestigationActivity" });
}
