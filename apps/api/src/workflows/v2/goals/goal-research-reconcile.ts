import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { loadResearchedInputs } from "./goal-content-inputs";
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
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";

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

/**
 * Only an exam's plan is built before research reads what it found (see `waitForGraphInputs`):
 * a goal built from the learner's material waits for research first, and a learn goal's coverage
 * check waits for its references.
 */
function isBuiltBeforeResearch(inputs: GoalCurriculumInputs): boolean {
  return inputs.goal.kind === "exam" && !inputs.hasMaterial;
}

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
 * The plan again from the reconciled graph, from today and keeping past work (what placement
 * tested out stays tested out; the notice's exam day becomes the target of a goal without a date
 * of its own), then what it needs next: outlines for its new stand-ins, and placement's questions
 * for its picks, now that the exam's format is known.
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

  await createGoalPlanStep({
    courseIdsByKey: curriculum.courseIdsByKey,
    goalId,
    graph,
    idsByKey,
    platform: context.analytics.platform ?? null,
    provenance: curriculum.provenance,
  });

  const [needs, firstSkillId] = await Promise.all([
    listPlanOutlineNeedsStep(goalId),
    readPlanFirstSkillStep(goalId),
  ]);

  await Promise.all([
    startOutlines({ context, courses: needs, firstSkillId, forGuest: researched.isGuest }),
    preparePlacementItemsStep({ ...context, goalId }),
  ]);
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

  if (checked.changed || linkedBlueprint) {
    await replan({ context, curriculum, graph: checked.graph, researched, scope });
  }
}

/**
 * An exam's plan is built from the goal as understood, before research reads a new notice, so
 * the learner's first placement question never waits for it. Once research ends (or half an hour
 * or so runs out), the plan is reconciled with what it read, beside the work written ahead for the
 * learner: the graph is checked against the notice the goal gained or research changed (and any
 * reference research linked), which adds the skills the notice expects and the graph missed, with
 * their exam weight, and corrects the weights its areas and topic frequency show are off. Nothing
 * is removed: a skill the notice doesn't test stays, at weight 1 when the check says so. When the
 * graph changed or the goal gained its blueprint, the plan is built again (see `replan`). Research
 * that ends without a notice leaves the plan as it is, and so does a failure here. It reports no
 * progress: every wait of the learner's ended with the plan.
 */
export async function reconcileResearch({ researchId, ...input }: ReconcileInput): Promise<void> {
  if (!researchId || !isBuiltBeforeResearch(input.inputs)) {
    return;
  }

  const [outcome] = await Promise.allSettled([reconcile({ ...input, researchId })]);

  if (outcome.status === "rejected") {
    await trackGenerationFailedStep({
      analytics: input.context.analytics,
      contentKind: "curriculum",
      task: "research-reconcile",
    });
  }
}
