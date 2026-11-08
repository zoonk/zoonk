import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { GOAL_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata } from "workflow";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { closeStepStream } from "../_shared/stream-status";
import { updateCoursesBehind } from "../products/product-releases";
import { prepareAhead, startPairLevelTest } from "./goal-ahead";
import { isBuiltBeforeResearch } from "./goal-content-inputs";
import { followPlanStart } from "./goal-lookahead";
import { outlinePlanAhead } from "./goal-outlines";
import { preparePlanPlacement } from "./goal-placement-items";
import { buildPlan } from "./goal-plan-build";
import { reconcileResearch, reconcileStoredPlan } from "./goal-research-reconcile";
import { type GoalRunContext } from "./goal-run-context";
import { setUpPlan } from "./plan-setup";
import { isPlanPreparedStep, recordGoalBuildFailureStep } from "./steps/goal-build-outcome-steps";
import { decideGoalScopeStep, loadGoalCurriculumStep } from "./steps/goal-curriculum-steps";
import { listPlanSetupTasksStep, prepareCourseGoalPlanStep } from "./steps/goal-plan-steps";
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
  status: "built" | "missing" | "prepared" | "ready";
  speculativeLessonIds: string[];
};

export function getGoalContentToken({
  goalId,
  rebuild,
}: Pick<GoalContentInput, "goalId" | "rebuild">): string {
  return `goal-${rebuild ? "rebuild" : "content"}:${goalId}`;
}

async function reportBuildFailure({
  context,
  goalId,
  last = true,
}: {
  context: GoalRunContext;
  goalId: string;
  last?: boolean;
}) {
  await Promise.all([
    goalProgressStep(
      {
        entityId: goalId,
        reason: "aiGenerationFailed",
        status: "error",
        step: WORKFLOW_ERROR_STEP,
      },
      { last },
    ),
    recordGoalBuildFailureStep({ generationId: context.workflowRunId, goalId }),
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
    await goalProgressStep(
      { entityId: goalId, status: "completed", step: GOAL_READY_STEP },
      { last: true },
    );

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

  await goalProgressStep(
    { entityId: goalId, status: "completed", step: GOAL_READY_STEP },
    { last: true },
  );

  await Promise.all([
    followPlanStart({ context, inputs, started: speculativeLessonIds }),
    reconcileRestartedResearch({ context, inputs, researchId }),
  ]);

  return { goalId, speculativeLessonIds, status: "prepared" };
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

  await goalProgressStep({ entityId: goalId, status: "started", step: "prepareFirstLessons" });
  const [speculativeLessonIds] = await prepareAhead({ context, inputs, rebuild });
  await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });
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

  const { plan, warmUp } = buildPlan({ context, initial, input });

  const built = await plan.catch(async (error: unknown) => {
    try {
      await reportBuildFailure({ context, goalId, last: false });
    } finally {
      await warmUp;
      await closeStepStream();
    }

    throw error;
  });

  if (!built) {
    try {
      await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });
    } finally {
      await warmUp;
      await closeStepStream();
    }

    return { goalId, speculativeLessonIds: [], status: "ready" };
  }

  const { curriculum, firstLesson, inputs, researchId, scope } = built;
  const prepared = prepareAheadOfLearner({ context, inputs, rebuild });
  const closed = Promise.allSettled([prepared, warmUp, firstLesson]).then(() => closeStepStream());

  try {
    const [speculativeLessonIds] = await Promise.all([
      prepared.then(async (started) => {
        if (!rebuild) {
          await followPlanStart({ context, inputs, started });
        }

        return started;
      }),
      rebuild ? null : reconcileResearch({ context, curriculum, inputs, researchId, scope }),
    ]);

    return { goalId, speculativeLessonIds, status: "built" };
  } finally {
    await closed;
  }
}

async function loadInitialCurriculum({
  input,
  workflowRunId,
}: {
  input: GoalContentInput;
  workflowRunId: string;
}) {
  const initial = await loadGoalCurriculumStep(input.goalId);

  if (!initial) {
    return null;
  }

  const goalId = input.goalId;
  const analytics = { distinctId: initial.goal.userId, goalId, platform: input.platform };
  const context = { analytics, workflowRunId };

  if (input.rebuild || !initial.startedCourse || initial.hasPlanGraph) {
    return { context, initial };
  }

  try {
    await prepareCourseGoalPlanStep({ goalId: input.goalId, platform: input.platform ?? null });
    await updateCoursesBehind([initial.startedCourse.id]);
    const prepared = await loadGoalCurriculumStep(goalId);
    return prepared ? { context, initial: prepared } : null;
  } catch (error) {
    await reportBuildFailure({ context, goalId });
    throw error;
  }
}

export async function goalContentWorkflow(input: GoalContentInput): Promise<GoalContentResult> {
  "use workflow";

  const { goalId } = input;
  const { workflowRunId } = getWorkflowMetadata();

  await recordGoalRunStep({ generationId: workflowRunId, goalId });
  await goalProgressStep({ entityId: goalId, status: "started", step: "understandGoal" });

  const loaded = await loadInitialCurriculum({ input, workflowRunId });

  if (!loaded) {
    await goalProgressStep(
      { entityId: goalId, reason: "notFound", status: "error", step: WORKFLOW_ERROR_STEP },
      { last: true },
    );

    return { goalId, speculativeLessonIds: [], status: "missing" };
  }

  const { context, initial } = loaded;

  if (initial.hasPlanGraph && !input.rebuild) {
    return prepareExistingPlan({ context, inputs: initial, researchId: input.researchId });
  }

  // The first build is still running, and reads the new source when it gets to the graph.
  if (!initial.hasPlanGraph && input.rebuild) {
    await goalProgressStep(
      { entityId: goalId, status: "completed", step: GOAL_READY_STEP },
      { last: true },
    );

    return { goalId, speculativeLessonIds: [], status: "ready" };
  }

  return buildGoal({ context, initial, input });
}
