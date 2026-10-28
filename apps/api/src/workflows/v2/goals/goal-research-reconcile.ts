import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { mergeAddedTwins, saveAddedSkills } from "./goal-added-skills";
import { isBuiltBeforeResearch, loadResearchedInputs } from "./goal-content-inputs";
import { type BuiltCurriculum, startOutlines } from "./goal-curriculum";
import { type GoalRunContext } from "./goal-run-context";
import { preparePlacementItems } from "./placement-items";
import { checkGraphCoverageStep, saveExamSkillGraphStep } from "./steps/goal-curriculum-steps";
import {
  listPlanOutlineNeedsStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";
import { followNoticeStep } from "./steps/goal-plan-steps";
import {
  claimNoticeLandingStep,
  endNoticeWaitStep,
  logReconcileFailureStep,
  proposeNoticeChangeStep,
} from "./steps/notice-steps";

type Reference = GoalCurriculumInputs["references"][number];

type ReconcileInput = {
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  inputs: GoalCurriculumInputs;
  researchId?: string | null;
  scope: CurriculumScope;
};

function isKnownReference({ known, reference }: { known: Reference[]; reference: Reference }) {
  return known.some((item) => item.title === reference.title && item.text === reference.text);
}

function listResearchedReferences({
  after,
  before,
}: {
  after: GoalCurriculumInputs;
  before: GoalCurriculumInputs;
}): Reference[] {
  const blueprint = after.blueprintReference;
  const isNewBlueprint = blueprint !== null && blueprint.text !== before.blueprintReference?.text;

  const linked = after.references.filter(
    (reference) => !isKnownReference({ known: before.references, reference }),
  );

  return isNewBlueprint ? [blueprint, ...linked] : linked;
}

function keepExamGraph({
  curriculum,
  graph,
  idsByKey,
  researched,
  scope,
}: {
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  idsByKey: Record<string, string>;
  researched: GoalCurriculumInputs;
  scope: CurriculumScope;
}): Promise<void> {
  return saveExamSkillGraphStep({
    courseIdsByKey: curriculum.courseIdsByKey,
    graph,
    idsByKey,
    inputs: researched,
    provenance: curriculum.provenance,
    scope,
  });
}

/** Once the step gives up, the wait runs out by itself. */
function endNoticeWait(goalId: string): Promise<unknown> {
  return endNoticeWaitStep(goalId).catch(() => null);
}

/**
 * A step that gives up counts as missed, so the reading is proposed instead of changing a plan the
 * learner may have seen.
 */
function claimNoticeLanding(goalId: string): Promise<boolean> {
  return claimNoticeLandingStep(goalId).catch(() => false);
}

/** False when the reveal stopped waiting before the plan could be saved: nothing changed. */
async function followNotice({
  context,
  curriculum,
  goalId,
  graph,
  idsByKey,
}: {
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  goalId: string;
  graph: BuiltCurriculum["graph"];
  idsByKey: Record<string, string>;
}) {
  const landed = await retryPlanConflicts(followNoticeStep, {
    courseIdsByKey: curriculum.courseIdsByKey,
    goalId,
    graph,
    idsByKey,
    platform: context.analytics.platform ?? null,
    provenance: curriculum.provenance,
  });

  await endNoticeWait(goalId);
  return landed;
}

async function proposeSavedReading({
  curriculum,
  graph,
  idsByKey,
  researched,
  scope,
}: {
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  idsByKey: Record<string, string>;
  researched: GoalCurriculumInputs;
  scope: CurriculumScope;
}) {
  await proposeNoticeChangeStep({
    courseIdsByKey: curriculum.courseIdsByKey,
    goalId: researched.goal.id,
    graph,
    idsByKey,
  });

  await keepExamGraph({ curriculum, graph, idsByKey, researched, scope });
}

/**
 * Returns whether the plan followed the notice; when the reveal stopped waiting first, the reading
 * waits on Today instead.
 */
async function replan({
  context,
  curriculum,
  graph,
  researched,
  scope,
}: {
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  researched: GoalCurriculumInputs;
  scope: CurriculumScope;
}) {
  const goalId = researched.goal.id;
  const idsByKey = await saveAddedSkills({ context, curriculum, graph, scope });

  if (!(await followNotice({ context, curriculum, goalId, graph, idsByKey }))) {
    await proposeSavedReading({ curriculum, graph, idsByKey, researched, scope });
    return false;
  }

  await keepExamGraph({ curriculum, graph, idsByKey, researched, scope });

  const lookahead = await readGoalLookaheadStep(goalId);

  const [needs, firstSkillId] = await Promise.all([
    listPlanOutlineNeedsStep({ days: lookahead.outlineDays, goalId }),
    readPlanFirstSkillStep(goalId),
  ]);

  await Promise.all([
    startOutlines({ context, courses: needs, firstSkillId, forGuest: researched.isGuest }),
    preparePlacementItems({ ...context, forPlacement: true, goalId }),
  ]);

  return true;
}

async function proposeReading({
  context,
  curriculum,
  graph,
  researched,
  scope,
}: {
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  researched: GoalCurriculumInputs;
  scope: CurriculumScope;
}) {
  const idsByKey = await saveAddedSkills({ context, curriculum, graph, scope });
  await proposeSavedReading({ curriculum, graph, idsByKey, researched, scope });
}

async function reconcile({
  context,
  curriculum,
  inputs,
  researchId,
  scope,
}: ReconcileInput & { researchId: string }) {
  const researched = await loadResearchedInputs({ inputs, late: true, researchId });

  if (!researched) {
    return;
  }

  const goalId = inputs.goal.id;

  // A reading that lands while the reveal waits becomes part of the plan.
  const landed = await claimNoticeLanding(goalId);

  const references = listResearchedReferences({ after: researched, before: inputs });
  const blueprintId = researched.goal.examBlueprintId;
  const linkedBlueprint = blueprintId !== null && blueprintId !== inputs.goal.examBlueprintId;

  const covered =
    references.length > 0
      ? await checkGraphCoverageStep({
          ...context,
          graph: curriculum.graph,
          inputs: researched,
          references,
          scope,
        })
      : { changed: false, graph: curriculum.graph };

  const checked = {
    changed: covered.changed,
    graph: await mergeAddedTwins({ context, curriculum, graph: covered.graph, scope }),
  };

  const changesGraph = checked.changed || linkedBlueprint;

  // A check that outlasts the landing's wait may have let the learner see the plan meanwhile.
  if (landed && (await claimNoticeLanding(goalId))) {
    if (changesGraph) {
      // A reading that came too late waits on Today whole, its exam day included (see `replan`).
      if (await replan({ context, curriculum, graph: checked.graph, researched, scope })) {
        await proposeNoticeChangeStep({ goalId });
      }

      return;
    }

    await followNotice({
      context,
      curriculum,
      goalId,
      graph: curriculum.graph,
      idsByKey: curriculum.idsByKey,
    });

    await keepExamGraph({
      curriculum,
      graph: curriculum.graph,
      idsByKey: curriculum.idsByKey,
      researched,
      scope,
    });

    // A date the learner gave that isn't the notice's day is theirs to change; one the plan
    // didn't follow, as the reveal stopped waiting first, waits on Today too.
    await proposeNoticeChangeStep({ goalId });
    return;
  }

  if (changesGraph) {
    await proposeReading({ context, curriculum, graph: checked.graph, researched, scope });
    return;
  }

  // The notice adds nothing to the plan, but its exam day may not be the goal's.
  await proposeNoticeChangeStep({ goalId });

  await keepExamGraph({
    curriculum,
    graph: curriculum.graph,
    idsByKey: curriculum.idsByKey,
    researched,
    scope,
  });
}

/**
 * A reading that lands after the learner saw the plan never changes it silently: it waits on Today
 * as one change to apply. A failure here leaves the plan usable, so it's logged, not thrown.
 */
export async function reconcileResearch({ researchId, ...input }: ReconcileInput): Promise<void> {
  if (!researchId || !isBuiltBeforeResearch({ inputs: input.inputs, researchId })) {
    return;
  }

  const goalId = input.inputs.goal.id;
  const [outcome] = await Promise.allSettled([reconcile({ ...input, researchId })]);

  await endNoticeWait(goalId);

  if (outcome.status === "rejected") {
    const reason: unknown = outcome.reason;

    await Promise.all([
      logReconcileFailureStep({
        error: reason instanceof Error ? reason.message : String(reason),
        goalId,
        researchId,
      }),
      trackGenerationFailedStep({
        analytics: input.context.analytics,
        contentKind: "curriculum",
        task: "research-reconcile",
      }),
    ]);
  }
}

export async function reconcileStoredPlan({
  context,
  curriculum,
  inputs,
  researchId,
  scope,
}: ReconcileInput & { researchId: string }): Promise<void> {
  const [outcome] = await Promise.allSettled([
    loadResearchedInputs({ inputs, late: true, researchId }).then(async (researched) => {
      if (!researched?.goal.examBlueprintId) {
        return;
      }

      const goalId = inputs.goal.id;

      const references = [researched.blueprintReference, ...researched.references].filter(
        (reference) => reference !== null,
      );

      const checked = await checkGraphCoverageStep({
        ...context,
        graph: curriculum.graph,
        inputs: researched,
        references,
        scope,
      });

      await (checked.changed
        ? proposeReading({ context, curriculum, graph: checked.graph, researched, scope })
        : proposeNoticeChangeStep({ goalId }));
    }),
  ]);

  if (outcome.status === "rejected") {
    await trackGenerationFailedStep({
      analytics: context.analytics,
      contentKind: "curriculum",
      task: "research-reconcile",
    });
  }
}
