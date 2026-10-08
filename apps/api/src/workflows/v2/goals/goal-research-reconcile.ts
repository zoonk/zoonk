import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { isBuiltBeforeResearch, loadResearchedInputs } from "./goal-content-inputs";
import { type BuiltCurriculum, startOutlines, toSlices } from "./goal-curriculum";
import { type GoalRunContext } from "./goal-run-context";
import {
  checkGraphCoverageStep,
  createGoalPlanStep,
  linkSkillPrerequisitesStep,
  saveGoalSkillsStep,
} from "./steps/goal-curriculum-steps";
import {
  listPlanOutlineNeedsStep,
  preparePlacementItemsStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";
import {
  claimNoticeLandingStep,
  endNoticeWaitStep,
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

/** The skills the check added, saved to the Library in slices, with their prerequisites linked. */
async function saveAddedSkills({
  context,
  curriculum,
  graph,
  scope,
}: {
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  scope: CurriculumScope;
}): Promise<Record<string, string>> {
  const added = graph.skills.filter((skill) => curriculum.idsByKey[skill.key] === undefined);

  if (added.length === 0) {
    return curriculum.idsByKey;
  }

  const saved = await Promise.all(
    toSlices(added).map((skills) =>
      saveGoalSkillsStep({ ...context, provenance: curriculum.provenance, scope, skills }),
    ),
  );

  const idsByKey = Object.fromEntries(
    [curriculum.idsByKey, ...saved].flatMap((ids) => Object.entries(ids)),
  );

  await linkSkillPrerequisitesStep({ idsByKey, skills: added });
  return idsByKey;
}

/**
 * The plan again, from today and keeping past work (what placement tested out stays tested out),
 * following the notice: its exam day becomes the target of a goal without a date of its own, or
 * replaces one the plan took from the notice before. Then the reveal stops waiting.
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
  await createGoalPlanStep({
    courseIdsByKey: curriculum.courseIdsByKey,
    followNotice: true,
    goalId,
    graph,
    idsByKey,
    platform: context.analytics.platform ?? null,
    provenance: curriculum.provenance,
  });

  // The reveal waited for this plan; what it needs next doesn't hold the learner.
  await endNoticeWaitStep(goalId);
}

/**
 * The plan again from the reconciled graph, following the notice (`followNotice`), then what it
 * needs next: outlines for its new stand-ins, and placement's questions for its picks, now that
 * the exam's format is known.
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

  await followNotice({ context, curriculum, goalId, graph, idsByKey });

  const lookahead = await readGoalLookaheadStep(goalId);

  const [needs, firstSkillId] = await Promise.all([
    listPlanOutlineNeedsStep({ days: lookahead.outlineDays, goalId }),
    readPlanFirstSkillStep(goalId),
  ]);

  await Promise.all([
    startOutlines({ context, courses: needs, firstSkillId, forGuest: researched.isGuest }),
    preparePlacementItemsStep({ ...context, goalId }),
  ]);
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
  goalId,
  scope,
}: {
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  goalId: string;
  scope: CurriculumScope;
}) {
  const idsByKey = await saveAddedSkills({ context, curriculum, graph, scope });

  await proposeNoticeChangeStep({
    courseIdsByKey: curriculum.courseIdsByKey,
    goalId,
    graph,
    idsByKey,
  });
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
  const landed = await claimNoticeLandingStep(goalId);

  const references = listResearchedReferences({ after: researched, before: inputs });
  const blueprintId = researched.goal.examBlueprintId;
  const linkedBlueprint = blueprintId !== null && blueprintId !== inputs.goal.examBlueprintId;

  const checked =
    references.length > 0
      ? await checkGraphCoverageStep({
          ...context,
          graph: curriculum.graph,
          prompt: researched.graphPrompt,
          references,
          scope,
        })
      : { changed: false, graph: curriculum.graph };

  const changesGraph = checked.changed || linkedBlueprint;

  // A check that outlasts the landing's wait may have let the learner see the plan meanwhile.
  if (landed && (await claimNoticeLandingStep(goalId))) {
    await (changesGraph
      ? replan({ context, curriculum, graph: checked.graph, researched, scope })
      : followNotice({
          context,
          curriculum,
          goalId,
          graph: curriculum.graph,
          idsByKey: curriculum.idsByKey,
        }));

    // A date the learner gave that isn't the notice's day is theirs to change.
    await proposeNoticeChangeStep({ goalId });
    return;
  }

  if (changesGraph) {
    await proposeReading({ context, curriculum, goalId, graph: checked.graph, scope });
    return;
  }

  // The notice adds nothing to the plan, but its exam day may not be the goal's.
  await proposeNoticeChangeStep({ goalId });
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
 * leaves the plan as it is, and so does a failure here; either way the plan stops waiting. It
 * reports no progress: every wait of the learner's ended with the plan.
 */
export async function reconcileResearch({ researchId, ...input }: ReconcileInput): Promise<void> {
  if (!researchId || !isBuiltBeforeResearch({ inputs: input.inputs, researchId })) {
    return;
  }

  const goalId = input.inputs.goal.id;
  const [outcome] = await Promise.allSettled([reconcile({ ...input, researchId })]);

  await endNoticeWaitStep(goalId);

  if (outcome.status === "rejected") {
    await trackGenerationFailedStep({
      analytics: input.context.analytics,
      contentKind: "curriculum",
      task: "research-reconcile",
    });
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
        prompt: researched.graphPrompt,
        references,
        scope,
      });

      await (checked.changed
        ? proposeReading({ context, curriculum, goalId, graph: checked.graph, scope })
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
