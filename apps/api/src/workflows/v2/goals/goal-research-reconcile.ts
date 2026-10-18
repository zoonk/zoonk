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
  /** What the first build wrote: the graph the plan came from, its skills' and courses' ids. */
  curriculum: BuiltCurriculum;
  /** The goal as its graph read it. */
  inputs: GoalCurriculumInputs;
  researchId?: string | null;
  scope: CurriculumScope;
};

function isKnownReference({ known, reference }: { known: Reference[]; reference: Reference }) {
  return known.some((item) => item.title === reference.title && item.text === reference.text);
}

/**
 * What research gave the goal that its graph didn't read: the exam's blueprint when the goal
 * gained one or research changed it, and the references research linked.
 */
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

/**
 * The exam's shared graph follows what the notice's reading checked this run's graph against: the
 * first written for the exam keeps the skills it adds (`saveExamSkillGraphStep`).
 */
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

/** The plan stops waiting; once the step's retries run out, the wait runs out by itself. */
function endNoticeWait(goalId: string): Promise<unknown> {
  return endNoticeWaitStep(goalId).catch(() => null);
}

/**
 * Whether the reading still lands before the learner saw the plan; once the step's retries run
 * out, it counts as missed, so the reading is proposed instead of changing a plan they may have seen.
 */
function claimNoticeLanding(goalId: string): Promise<boolean> {
  return claimNoticeLandingStep(goalId).catch(() => false);
}

/**
 * The plan again, from today and keeping past work (what placement tested out stays tested out),
 * following the notice: its exam day becomes the target of a goal without a date of its own, or
 * replaces one the plan took from the notice before. Then the reveal stops waiting. False when it
 * had stopped waiting before the plan could be saved (see `followNoticeStep`): nothing changed.
 */
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

  // The reveal waited for this plan; what it needs next doesn't hold the learner.
  await endNoticeWait(goalId);
  return landed;
}

/**
 * The graph research's reading wrote, its added skills already in the Library, with the notice's
 * exam day: it waits on Today for the learner's Apply or "Keep mine". The exam's graph is the
 * exam's either way.
 */
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
 * The plan again from the reconciled graph, following the notice (`followNotice`), then what it
 * needs next: outlines for its new stand-ins, and placement's questions for its picks, now that
 * the exam's format is known. When the reveal stopped waiting before the plan could be saved, the
 * reading waits on Today instead, as one that lands after the learner saw the plan (see
 * `proposeSavedReading`). Returns whether the plan followed the notice.
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

/**
 * What research's reading changes once the learner saw the plan: the skills it adds go to the
 * Library, and the graph it wrote, with the notice's exam day, waits on Today for the learner's
 * Apply or "Keep mine".
 */
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

  // A reading that lands while the reveal waits is part of the plan: the reveal keeps waiting
  // while the plan is checked against it and built again with it.
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
 * An exam's plan is built from the goal as understood, before research reads a new notice, so
 * the learner's first placement question never waits for it; the plan then waits for that reading
 * (started when the plan is saved, see `buildCurriculum`), and the reveal says it's reading the
 * notice. Once research ends (or half
 * an hour or so runs out), the plan is reconciled with what it read, beside the work written ahead
 * for the learner: the graph is checked against the notice the goal gained or research changed
 * (and any reference research linked), which adds the skills the notice expects and the graph
 * missed, with their exam weight, and corrects the weights its areas and topic frequency show are
 * off. Nothing is removed: a skill the notice doesn't test stays, at weight 1 when the check says
 * so. A reading that lands while the reveal still waits becomes part of the plan: the reveal keeps
 * waiting while the plan is checked against it and built again, and the plan simply follows the
 * notice's exam day, even when the graph doesn't change (see `followNotice`). One that lands after
 * the learner saw the plan never changes it silently: it waits on Today as one change to apply,
 * with the notice's exam day (see `proposeNoticeChange`). A notice day that isn't the date the
 * learner gave is proposed the same way. Research that ends without a notice
 * leaves the plan as it is, and so does a failure here, once its steps' retries run out: the plan
 * stays usable, so the failure is logged and recorded rather than failing the run; either way the
 * plan stops waiting. It reports no progress: every wait of the learner's ended with the plan.
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

/**
 * Research that started after the plan was built (it restarted, as after a run that failed or
 * stalled) still reaches the plan: once it ends, the notice it read is checked against the plan's
 * graph, rebuilt from the stored plan (`curriculum`), and what it adds waits on Today as one
 * change to apply, with the notice's exam day, like a reading that lands after the reveal (see
 * `reconcileResearch`). A notice that adds nothing still proposes its day when it isn't the goal's.
 */
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
