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
import { type BuiltCurriculum, buildCurriculum, startOutlines } from "./goal-curriculum";
import { followPlanStart } from "./goal-lookahead";
import { preparePlanPlacement } from "./goal-placement-items";
import { reconcileResearch, reconcileStoredPlan } from "./goal-research-reconcile";
import { type GoalRunContext } from "./goal-run-context";
import { isPlanPreparedStep, recordGoalBuildFailureStep } from "./steps/goal-build-outcome-steps";
import { decideGoalScopeStep, loadGoalCurriculumStep } from "./steps/goal-curriculum-steps";
import {
  listPlanOutlineNeedsStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";
import { goalProgressStep } from "./steps/goal-progress-step";
import { recordGoalRunStep } from "./steps/record-goal-run-step";
import { loadStoredCurriculumStep } from "./steps/stored-plan-steps";

export type GoalContentInput = {
  goalId: string;
  /**
   * The research run started with the goal: a learn goal's coverage check waits for the
   * references it finds, a goal built from the learner's material waits for it before its graph,
   * and an exam's plan is reconciled with the notice it reads once the plan is built.
   */
  researchId?: string | null;
  /**
   * The learner's upload answered research's ask after the plan was built: the curriculum is built
   * again from what research read (the exam's notice, the official source, the class's material),
   * keeping past work.
   */
  rebuild?: boolean;
  /** The client whose request started the run, for analytics. */
  platform?: AnalyticsPlatform | null;
};

export type GoalContentResult = {
  goalId: string;
  /**
   * `built`: this run built the plan. `prepared`: the plan came with the goal (a plan link, a
   * course start) and this run wrote placement's questions and the first lessons ahead for it.
   * `ready`: nothing was left to do.
   */
  status: "built" | "joined" | "missing" | "prepared" | "ready";
  /** Lessons generated ahead while placement runs. */
  speculativeLessonIds: string[];
};

/** Reports a plan that couldn't be built, so placement and the plan offer to start it again. */
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

/**
 * An exam's plan built before research `researchId` started (research restarted) is reconciled
 * with what it reads, from the stored plan (`reconcileStoredPlan`); any other plan has nothing to
 * wait for.
 */
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

/**
 * A goal that came with its plan (a plan link, a course start) gets what a built plan gets ahead,
 * once: outlines for the stand-ins its courses haven't written (within the learner's outline
 * window; later ones as the plan gets close), placement's questions for its skills, the likeliest
 * first lessons, and a language's level test.
 */
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

  if (await isPlanPreparedStep(goalId)) {
    await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });
    await reconcileRestartedResearch({ context, inputs, researchId });
    return { goalId, speculativeLessonIds: [], status: "ready" };
  }

  const lookahead = await readGoalLookaheadStep(goalId);

  const [needs, firstSkillId] = await Promise.all([
    listPlanOutlineNeedsStep({ days: lookahead.outlineDays, goalId }),
    readPlanFirstSkillStep(goalId),
  ]);

  await startOutlines({ context, courses: needs, firstSkillId, forGuest: inputs.isGuest });
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
  /** The research the plan is reconciled with: none once the graph waited for its reading. */
  researchId: string | null;
  scope: CurriculumScope;
};

/**
 * Builds the plan once its inputs are ready: the curriculum's inputs it was built from and what
 * it wrote, or null when there was nothing to build (the goal was deleted meanwhile, or a rebuild
 * found the first build still running, which reads the new source when it gets to the graph).
 */
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

  // Who the curriculum is for needs only the goal as typed, so it's decided while the learner
  // answers the questions that shape the graph, and while research reads their material.
  const [inputs, scope] = await Promise.all([
    waitForGraphInputs({ initial, researchId: input.researchId }),
    decideGoalScopeStep({ ...context, inputs: initial }),
    rebuild ? null : startPairLevelTest({ context, goal: initial.goal }),
  ]);

  if (!inputs || inputs.hasPlanGraph !== rebuild) {
    return null;
  }

  // A notice research read again before the graph (see `waitForGraphInputs`) is already in it.
  const researchId = initial.readsNoticeAgain ? null : (input.researchId ?? null);
  const curriculum = await buildCurriculum({ context, inputs, rebuild, researchId, scope });

  return { curriculum, inputs, researchId, scope };
}

/**
 * What the learner reaches after placement, written ahead; the goal is ready once it's started,
 * and a first build then follows the plan's start as placement moves it.
 */
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

/**
 * Builds the plan (a failure is recorded, so the learner's screens offer to try again), then
 * writes ahead what the learner reaches after placement while a first build reconciles an exam's
 * plan with the notice research reads meanwhile; the run ends when both are done.
 */
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

/**
 * Turns a new goal into its curriculum as soon as it's submitted: the skill graph (an exam's
 * follows the blueprint the goal has, or the exam as onboarding understood it; reference syllabi
 * add what it missed), every skill in the Library through identity search so goals share skills
 * and lessons, the plan at the learner's daily minutes (one stand-in per skill), and the outlines
 * of its courses, the band the learner reaches first first. Too specific a goal gets a private
 * course on cheaper models. Placement's questions are written alongside the plan, and placement
 * asks each as soon as it's written; while placement runs, the first lessons of the two likeliest
 * starting phases start generating, with questions in the learner's field for work goals, past
 * papers where an exam allows it, free-response ones for AP, and a language's level test and
 * alphabet lesson. Meanwhile, an exam's plan is reconciled with the notice research reads:
 * missing skills added, exam weights corrected, the plan built again with the exam's day
 * (`reconcileResearch`). A goal that came with its plan gets the same work ahead once. One run per
 * goal: a second start joins it, or takes over from one that stalled (a crash or a restart left it
 * half done, `claimRunToken`), and a goal whose plan was already built isn't rebuilt, unless the
 * learner's upload answered research's ask (`rebuild`, one at a time per goal). A plan that
 * couldn't be built is recorded, so the learner's screens offer to try again.
 */
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

  // A rebuild of a goal whose first build is still running leaves it to that run, which reads the
  // new source when it gets to the graph.
  if (!initial.hasPlanGraph && rebuild) {
    await goalProgressStep({ entityId: goalId, status: "completed", step: GOAL_READY_STEP });
    return { goalId, speculativeLessonIds: [], status: "ready" };
  }

  return buildGoal({ context, initial, input });
}
