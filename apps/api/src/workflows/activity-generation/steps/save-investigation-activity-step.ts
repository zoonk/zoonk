import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityInvestigationAccuracySchema } from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import { type ActivityInvestigationActionsSchema } from "@zoonk/ai/tasks/activities/core/investigation-actions";
import { type ActivityInvestigationDebriefSchema } from "@zoonk/ai/tasks/activities/core/investigation-debrief";
import { type ActivityInvestigationFindingsSchema } from "@zoonk/ai/tasks/activities/core/investigation-findings";
import { type ActivityInvestigationInterpretationsSchema } from "@zoonk/ai/tasks/activities/core/investigation-interpretations";
import { type ActivityInvestigationScenarioSchema } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { handleActivityFailureStep } from "./handle-failure-step";

type DispatchedVisual = { kind: string } & Record<string, unknown>;

/**
 * Zips scenario explanations with accuracy tiers to produce the
 * explanations array used in problem and call steps.
 */
function buildExplanationsWithAccuracy(
  scenario: ActivityInvestigationScenarioSchema,
  accuracy: ActivityInvestigationAccuracySchema,
) {
  return scenario.explanations.map((text, index) => ({
    accuracy: accuracy.accuracies[index] ?? "wrong",
    text,
  }));
}

/**
 * Builds the 5 step records for an investigation activity from AI outputs.
 *
 * - Position 0: investigation/problem — scenario, explanations with accuracy, visual
 * - Position 1: investigation/action — all actions with quality tiers
 * - Position 2: investigation/evidence — findings with visuals and interpretations
 * - Position 3: investigation/call — explanations with accuracy, fullExplanation
 * - Position 4: static/investigationScore — scoring is derived at runtime
 */
function buildInvestigationStepRecords({
  accuracy,
  activityId,
  actions,
  debrief,
  findings,
  findingVisuals,
  interpretations,
  scenario,
  scenarioVisual,
}: {
  accuracy: ActivityInvestigationAccuracySchema;
  activityId: number;
  actions: ActivityInvestigationActionsSchema;
  debrief: ActivityInvestigationDebriefSchema;
  findings: ActivityInvestigationFindingsSchema;
  findingVisuals: DispatchedVisual[];
  interpretations: ActivityInvestigationInterpretationsSchema[][];
  scenario: ActivityInvestigationScenarioSchema;
  scenarioVisual: DispatchedVisual;
}) {
  const explanations = buildExplanationsWithAccuracy(scenario, accuracy);

  const problemStep = {
    activityId,
    content: assertStepContent("investigation", {
      explanations,
      scenario: scenario.scenario,
      variant: "problem" as const,
      visual: scenarioVisual,
    }),
    isPublished: true,
    kind: "investigation" as const,
    position: 0,
  };

  const actionStep = {
    activityId,
    content: assertStepContent("investigation", {
      actions: actions.actions,
      variant: "action" as const,
    }),
    isPublished: true,
    kind: "investigation" as const,
    position: 1,
  };

  const evidenceStep = {
    activityId,
    content: assertStepContent("investigation", {
      findings: findings.findings.map((text, findingIndex) => ({
        interpretations: interpretations[findingIndex] ?? [],
        text,
        visual: findingVisuals[findingIndex] ?? { kind: "image" as const, prompt: "" },
      })),
      variant: "evidence" as const,
    }),
    isPublished: true,
    kind: "investigation" as const,
    position: 2,
  };

  const callStep = {
    activityId,
    content: assertStepContent("investigation", {
      explanations,
      fullExplanation: debrief.fullExplanation,
      variant: "call" as const,
    }),
    isPublished: true,
    kind: "investigation" as const,
    position: 3,
  };

  const scoreStep = {
    activityId,
    content: assertStepContent("static", {
      variant: "investigationScore" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: 4,
  };

  return [problemStep, actionStep, evidenceStep, callStep, scoreStep];
}

/**
 * Persists all generated investigation data in one transaction:
 * - Problem step with scenario, explanations, and visual
 * - Action step with all investigation actions
 * - Evidence step with findings, interpretations, and visuals
 * - Call step with explanations and debrief
 * - Score step for runtime scoring
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
  debrief,
  findings,
  findingVisuals,
  interpretations,
  scenario,
  scenarioVisual,
  workflowRunId,
}: {
  accuracy: ActivityInvestigationAccuracySchema;
  activityId: number;
  actions: ActivityInvestigationActionsSchema;
  debrief: ActivityInvestigationDebriefSchema;
  findings: ActivityInvestigationFindingsSchema;
  findingVisuals: DispatchedVisual[];
  interpretations: ActivityInvestigationInterpretationsSchema[][];
  scenario: ActivityInvestigationScenarioSchema;
  scenarioVisual: DispatchedVisual;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveInvestigationActivity" });

  const stepRecords = buildInvestigationStepRecords({
    accuracy,
    actions,
    activityId,
    debrief,
    findingVisuals,
    findings,
    interpretations,
    scenario,
    scenarioVisual,
  });

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
    await stream.error({ reason: "dbSaveFailed", step: "saveInvestigationActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  await stream.status({ status: "completed", step: "saveInvestigationActivity" });
}
