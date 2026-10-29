import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { GOAL_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata } from "workflow";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { claimRunToken } from "../_shared/run-token";
import { prepareAhead, startPairLevelTest } from "./goal-ahead";
import { isBuiltBeforeResearch, waitForGraphInputs } from "./goal-content-inputs";
import { type BuiltCurriculum, buildCurriculum, setUpPlan } from "./goal-curriculum";
import { followPlanStart } from "./goal-lookahead";
import { outlinePlanAhead } from "./goal-outlines";
import { preparePlanPlacement } from "./goal-placement-items";
import { reconcileResearch, reconcileStoredPlan } from "./goal-research-reconcile";
import { type GoalRunContext } from "./goal-run-context";
import { isPlanPreparedStep, recordGoalBuildFailureStep } from "./steps/goal-build-outcome-steps";
import {
  decideGoalScopeStep,
  keepMaterialPrivate,
  loadGoalCurriculumStep,
} from "./steps/goal-curriculum-steps";
import { listPlanSetupTasksStep } from "./steps/goal-plan-steps";
import { goalProgressStep } from "./steps/goal-progress-step";
import { recordGoalRunStep } from "./steps/record-goal-run-step";
import { loadStoredCurriculumStep } from "./steps/stored-plan-steps";

export type GoalContentInput = {
  goalId: string;
  researchId?: string | null;
  /** The learner's upload answered research's ask after the plan was built. */
  rebuild?: boolean;
  platform?: AnalyticsPlatform | null;
};

export type GoalContentResult = {
  goalId: string;
  status: "built" | "joined" | "missing" | "prepared" | "ready";
  speculativeLessonIds: string[];
};

async function reportBuildFailure({
  context,
  goalId,
}: {
  context: GoalRunContext;
  goalId: string;
}) {
  await Promise.all([
    goalProgressStep({
      entityId: goalId,
      reason: "aiGenerationFailed",
      status: "error",
      step: WORKFLOW_ERROR_STEP,
    }),
    recordGoalBuildFailureStep(goalId),
    trackGenerationFailedStep({
      analytics: context.analytics,
      contentKind: "curriculum",
      task: "goal-content",
    }),
  ]);
}

async function reconcileRestartedResearch({
  context,
  inputs,
  researchId,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  researchId?: string | null;
}): Promise<void> {
  if (!researchId || !isBuiltBeforeResearch({ inputs, researchId })) {
    return;
  }

  const curriculum = await loadStoredCurriculumStep({ goalId: inputs.goal.id, researchId });

  if (!curriculum) {
    return;
  }

  const scope = await decideGoalScopeStep({ ...context, inputs });
  await reconcileStoredPlan({ context, curriculum, inputs, researchId, scope });
}

async function prepareExistingPlan({
  context,
  inputs,
  researchId,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  researchId?: string | null;
}): Promise<GoalContentResult> {
  const goalId = inputs.goal.id;

  await setUpPlan({ goalId, tasks: await listPlanSetupTasksStep(goalId) });

  if (await isPlanPreparedStep(goalId)) {
    await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });
    await reconcileRestartedResearch({ context, inputs, researchId });
    return { goalId, speculativeLessonIds: [], status: "ready" };
  }

  await outlinePlanAhead({ context, forGuest: inputs.isGuest, goalId });
  await goalProgressStep({ entityId: goalId, status: "started", step: "prepareFirstLessons" });

  const [[speculativeLessonIds]] = await Promise.all([
    prepareAhead({ context, inputs, rebuild: false }),
    preparePlanPlacement({ context, goalId }),
    startPairLevelTest({ context, goal: inputs.goal }),
  ]);

  await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });

  await Promise.all([
    followPlanStart({ context, inputs, started: speculativeLessonIds }),
    reconcileRestartedResearch({ context, inputs, researchId }),
  ]);

  return { goalId, speculativeLessonIds, status: "prepared" };
}

type BuiltPlan = {
  curriculum: BuiltCurriculum;
  inputs: GoalCurriculumInputs;
  researchId: string | null;
  scope: CurriculumScope;
};

async function buildPlan({
  context,
  initial,
  input,
}: {
  context: GoalRunContext;
  initial: GoalCurriculumInputs;
  input: GoalContentInput;
}): Promise<BuiltPlan | null> {
  const rebuild = Boolean(input.rebuild);

  const [inputs, decided] = await Promise.all([
    waitForGraphInputs({ initial, researchId: input.researchId }),
    decideGoalScopeStep({ ...context, inputs: initial }),
    rebuild ? null : startPairLevelTest({ context, goal: initial.goal }),
  ]);

  if (!inputs || inputs.hasPlanGraph !== rebuild) {
    return null;
  }

  const scope = keepMaterialPrivate({ inputs, scope: decided });
  const researchId = input.researchId ?? null;
  const curriculum = await buildCurriculum({ context, inputs, rebuild, researchId, scope });

  return { curriculum, inputs, researchId, scope };
}

async function prepareAheadOfLearner({
  context,
  inputs,
  rebuild,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  rebuild: boolean;
}): Promise<string[]> {
  const goalId = inputs.goal.id;
  const [speculativeLessonIds] = await prepareAhead({ context, inputs, rebuild });

  await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });

  if (!rebuild) {
    await followPlanStart({ context, inputs, started: speculativeLessonIds });
  }

  return speculativeLessonIds;
}

async function buildGoal({
  context,
  initial,
  input,
}: {
  context: GoalRunContext;
  initial: GoalCurriculumInputs;
  input: GoalContentInput;
}): Promise<GoalContentResult> {
  const { goalId } = input;
  const rebuild = Boolean(input.rebuild);

  const built = await buildPlan({ context, initial, input }).catch(async (error: unknown) => {
    await reportBuildFailure({ context, goalId });
    throw error;
  });

  if (!built) {
    await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });
    return { goalId, speculativeLessonIds: [], status: "ready" };
  }

  const { curriculum, inputs, researchId, scope } = built;

  await goalProgressStep({ entityId: goalId, status: "started", step: "prepareFirstLessons" });

  const [speculativeLessonIds] = await Promise.all([
    prepareAheadOfLearner({ context, inputs, rebuild }),
    rebuild ? null : reconcileResearch({ context, curriculum, inputs, researchId, scope }),
  ]);

  return { goalId, speculativeLessonIds, status: "built" };
}

export async function goalContentWorkflow(input: GoalContentInput): Promise<GoalContentResult> {
  "use workflow";

  const { goalId } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const token = `goal-${input.rebuild ? "rebuild" : "content"}:${goalId}`;
  const { conflict } = await claimRunToken(token);

  if (conflict) {
    await goalProgressStep({
      entityId: conflict.runId,
      status: "started",
      step: "joinRunningGoal",
    });

    return { goalId, speculativeLessonIds: [], status: "joined" };
  }

  await recordGoalRunStep({ generationId: workflowRunId, goalId });
  await goalProgressStep({ entityId: goalId, status: "started", step: "understandGoal" });

  const initial = await loadGoalCurriculumStep(goalId);

  if (!initial) {
    await goalProgressStep({
      entityId: goalId,
      reason: "notFound",
      status: "error",
      step: WORKFLOW_ERROR_STEP,
    });

    return { goalId, speculativeLessonIds: [], status: "missing" };
  }

  const analytics = { distinctId: initial.goal.userId, goalId, platform: input.platform };
  const context = { analytics, workflowRunId };

  const rebuild = Boolean(input.rebuild);

  if (initial.hasPlanGraph && !rebuild) {
    return prepareExistingPlan({ context, inputs: initial, researchId: input.researchId });
  }

  // The first build is still running, and reads the new source when it gets to the graph.
  if (!initial.hasPlanGraph && rebuild) {
    await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });
    return { goalId, speculativeLessonIds: [], status: "ready" };
  }

  return buildGoal({ context, initial, input });
}
