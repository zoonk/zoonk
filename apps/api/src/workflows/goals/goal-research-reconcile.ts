import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { mergeAddedTwins, saveAddedSkills } from "./goal-added-skills";
import { isBuiltBeforeResearch, loadResearchedInputs } from "./goal-content-inputs";
import { findGoalCourses } from "./goal-courses";
import { type BuiltCurriculum } from "./goal-curriculum";
import { outlinePlanAhead } from "./goal-outlines";
import { type GoalRunContext } from "./goal-run-context";
import { preparePlacementItems } from "./placement-items";
import { reconcileNoticeGraph } from "./reconcile-notice-graph";
import {
  checkGraphCoverageStep,
  pruneNoticeGraphStep,
  saveExamSkillGraphStep,
} from "./steps/goal-curriculum-steps";
import { followNoticeStep } from "./steps/goal-plan-steps";
import { prepareGoalNoticeParamsStep } from "./steps/notice-graph-steps";
import {
  applyNoticeGraphStep,
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
  courseIdsByKey,
  curriculum,
  graph,
  idsByKey,
  researched,
  scope,
}: {
  courseIdsByKey: Record<string, string>;
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  idsByKey: Record<string, string>;
  researched: GoalCurriculumInputs;
  scope: CurriculumScope;
}): Promise<void> {
  return saveExamSkillGraphStep({
    courseIdsByKey,
    graph,
    idsByKey,
    inputs: researched,
    previous: curriculum,
    provenance: curriculum.provenance,
    scope,
  });
}

/** Once the step gives up, the wait runs out by itself. */
function endNoticeWait(goalId: string): Promise<unknown> {
  return endNoticeWaitStep(goalId).catch(() => null);
}

/**
 * A step that gives up counts as missed, so the reading lands as a change the learner can see.
 */
function claimNoticeLanding(goalId: string): Promise<boolean> {
  return claimNoticeLandingStep(goalId).catch(() => false);
}

async function checkResearchedGraph({
  context,
  curriculum,
  references,
  researched,
  scope,
}: Pick<ReconcileInput, "context" | "curriculum" | "scope"> & {
  references: Reference[];
  researched: GoalCurriculumInputs;
}) {
  const { graph } = curriculum;

  if (references.length === 0) {
    return { changed: false, graph, provenance: curriculum.provenance, provenanceByKey: {} };
  }

  const params = await prepareGoalNoticeParamsStep({ context, inputs: researched, scope });

  if (params) {
    return reconcileNoticeGraph({ graph, params, references });
  }

  const covered = await checkGraphCoverageStep({
    ...context,
    graph,
    inputs: researched,
    references,
    scope,
  });

  return { ...covered, provenance: curriculum.provenance, provenanceByKey: {} };
}

async function landReading({
  before,
  context,
  curriculum,
  references,
  researched,
  scope,
  waitsForReading = false,
}: {
  before: GoalCurriculumInputs;
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  references: Reference[];
  researched: GoalCurriculumInputs;
  scope: CurriculumScope;
  waitsForReading?: boolean;
}) {
  const { examBlueprintId: blueprintId, id: goalId } = researched.goal;

  if (!blueprintId) {
    return;
  }

  const covered = await checkResearchedGraph({
    context,
    curriculum,
    references,
    researched,
    scope,
  });

  const pruned = await pruneNoticeGraphStep({
    graph: covered.graph,
    outline: researched.graphPrompt.examBlueprint,
  });

  const changed =
    covered.changed || pruned.droppedKeys.length > 0 || before.goal.examBlueprintId !== blueprintId;

  const graph = changed
    ? await mergeAddedTwins({ context, curriculum, graph: pruned.graph, scope })
    : pruned.graph;

  const { provenance, provenanceByKey } = covered;

  const [idsByKey, courseIdsByKey] = await Promise.all([
    changed
      ? saveAddedSkills({ context, curriculum, graph, provenance, provenanceByKey, scope })
      : curriculum.idsByKey,
    findGoalCourses({
      ...context,
      courses: graph.courses,
      goal: researched.goal,
      product: researched.product,
      provenance,
      resolved: curriculum.courseIdsByKey,
      scope,
    }),
  ]);

  const keptIds = new Set(graph.skills.flatMap((skill) => idsByKey[skill.key] ?? []));

  const droppedSkillIds = pruned.droppedKeys.flatMap((key) => {
    const id = curriculum.idsByKey[key];
    return id && !keptIds.has(id) ? [id] : [];
  });

  const input = { courseIdsByKey, goalId, graph, idsByKey };

  const early =
    waitsForReading &&
    (await claimNoticeLanding(goalId)) &&
    (await retryPlanConflicts(followNoticeStep, {
      ...input,
      droppedNoticeSkillIds: droppedSkillIds,
      platform: context.analytics.platform ?? null,
      provenance: curriculum.provenance,
    }));

  if (changed && !early) {
    await retryPlanConflicts(applyNoticeGraphStep, { ...input, blueprintId, droppedSkillIds });
  }

  await keepExamGraph({ courseIdsByKey, curriculum, graph, idsByKey, researched, scope });
  await endNoticeWait(goalId);
  await proposeNoticeChangeStep({ goalId });

  if (changed) {
    await Promise.all([
      outlinePlanAhead({ context, forGuest: researched.isGuest, goalId }),
      preparePlacementItems({ ...context, forPlacement: true, goalId }),
    ]);
  }
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

  const waitsForReading = await claimNoticeLanding(inputs.goal.id);

  await landReading({
    before: inputs,
    context,
    curriculum,
    references: listResearchedReferences({ after: researched, before: inputs }),
    researched,
    scope,
    waitsForReading,
  });
}

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

      const references = [researched.blueprintReference, ...researched.references].filter(
        (reference) => reference !== null,
      );

      await landReading({ before: inputs, context, curriculum, references, researched, scope });
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
