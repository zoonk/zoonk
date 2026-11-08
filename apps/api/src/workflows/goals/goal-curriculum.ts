import { needsCoverageCheck } from "@zoonk/core/library/curriculum/add-coverage-skills";
import {
  pinGraphToCourse,
  toStartedCourseIds,
} from "@zoonk/core/library/curriculum/course-start-graph";
import {
  groupGoalCourseBands,
  keepNearCourseBands,
  orderGoalCourses,
  toGoalCourses,
} from "@zoonk/core/library/curriculum/goal-course-bands";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { startOnce } from "../_shared/run-token";
import { getSkillLevelsToken, skillLevelsWorkflow } from "../language/skill-levels-workflow";
import { updateCoursesBehind } from "../products/product-releases";
import { isBuiltBeforeResearch, loadGoalReferences } from "./goal-content-inputs";
import { findGoalCourses } from "./goal-courses";
import { startOutlines } from "./goal-outlines";
import { prepareGraphPlacement } from "./goal-placement-items";
import { type GoalRunContext, type SavedSlice } from "./goal-run-context";
import { buildGoalSkillGraph } from "./goal-skill-graph";
import { setUpPlan } from "./plan-setup";
import { setGoalPrimaryCourseStep } from "./steps/goal-course-steps";
import {
  checkGraphCoverageStep,
  linkSkillPrerequisitesStep,
  saveExamSkillGraphStep,
  saveGoalSkillsStep,
} from "./steps/goal-curriculum-steps";
import {
  listPlanSkillIdsWithinStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";
import { createGoalPlanStep } from "./steps/goal-plan-steps";
import { goalProgressStep } from "./steps/goal-progress-step";
import { mergeSkillTwinsStep } from "./steps/skill-twins-step";
import { claimLanguageGraphStep, reuseCurriculumStep } from "./steps/stored-plan-steps";

/** Skills go to the Library in slices, so every step stays short and retries alone. */
const SKILL_SLICE = 12;

export function toSlices<T>(items: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / SKILL_SLICE) }, (_, index) =>
    items.slice(index * SKILL_SLICE, (index + 1) * SKILL_SLICE),
  );
}

async function buildGraph({
  context,
  inputs,
  researchId,
  scope,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  researchId?: string | null;
  scope: CurriculumScope;
}) {
  const [built, references] = await Promise.all([
    buildGoalSkillGraph({ ...context, inputs, scope }),
    loadGoalReferences({ inputs, researchId }),
  ]);

  const outline = inputs.graphPrompt.examBlueprint;

  const covered = needsCoverageCheck({ graph: built.graph, outline, references })
    ? await checkGraphCoverageStep({ ...context, graph: built.graph, inputs, references, scope })
    : built;

  const graph = await mergeSkillTwinsStep({ ...context, graph: covered.graph, scope });

  return { ...built, graph };
}

type BuiltGraph = Awaited<ReturnType<typeof buildGraph>>;

export type BuiltCurriculum = BuiltGraph & {
  courseIdsByKey: Record<string, string>;
  idsByKey: Record<string, string>;
};

function pinStartedCourse({
  built,
  startedCourse,
}: {
  built: BuiltGraph;
  startedCourse: GoalCurriculumInputs["startedCourse"];
}): BuiltGraph {
  return startedCourse
    ? { ...built, graph: pinGraphToCourse({ course: startedCourse, graph: built.graph }) }
    : built;
}

type SavedCurriculum = Pick<BuiltCurriculum, "courseIdsByKey" | "idsByKey">;

async function saveCurriculum({
  courseIds,
  graph,
  goalId,
  slices,
}: {
  courseIds: Promise<Record<string, string>>;
  graph: BuiltGraph["graph"];
  goalId: string;
  slices: SavedSlice[];
}): Promise<SavedCurriculum> {
  const [saved, courseIdsByKey] = await Promise.all([Promise.all(slices), courseIds]);
  const idsByKey = Object.fromEntries(saved.flatMap((slice) => Object.entries(slice)));
  const [first] = orderGoalCourses(graph);
  const primaryCourseId = first ? courseIdsByKey[first.key] : undefined;

  if (primaryCourseId) {
    await setGoalPrimaryCourseStep({ courseId: primaryCourseId, goalId });
  }

  await linkSkillPrerequisitesStep({ idsByKey, skills: graph.skills });

  return { courseIdsByKey, idsByKey };
}

async function createPlanAndOutlines({
  built,
  context,
  inputs,
  reused,
  saved,
  scope,
  waitsForNotice,
}: {
  built: BuiltGraph;
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  reused: boolean;
  saved: Promise<SavedCurriculum>;
  scope: CurriculumScope;
  waitsForNotice: boolean;
}): Promise<SavedCurriculum> {
  const { graph, provenance } = built;
  const goalId = inputs.goal.id;
  const { courseIdsByKey, idsByKey } = await saved;

  const setupTasks = await retryPlanConflicts(createGoalPlanStep, {
    courseIdsByKey,
    goalId,
    graph,
    idsByKey,
    platform: context.analytics.platform ?? null,
    provenance,
    waitsForNotice,
  });

  if (!reused) {
    await saveExamSkillGraphStep({ courseIdsByKey, graph, idsByKey, inputs, provenance, scope });
  }

  await setUpPlan({ goalId, tasks: setupTasks });

  await goalProgressStep({ entityId: goalId, status: "completed", step: "createPlan" });

  const [firstSkillId, lookahead] = await Promise.all([
    readPlanFirstSkillStep(goalId),
    readGoalLookaheadStep(goalId),
  ]);

  const nearSkillIds = await listPlanSkillIdsWithinStep({ days: lookahead.outlineDays, goalId });

  // The learner's first lesson is always near, even in a plan with nothing scheduled yet.
  const near = keepNearCourseBands({
    nearSkillIds: new Set([...nearSkillIds, ...(firstSkillId ? [firstSkillId] : [])]),
    needs: groupGoalCourseBands({ graph, idsByKey }),
  });

  const courses = toGoalCourses({
    courseIdsByKey,
    graph,
    idsByKey,
    needs: near,
    scope,
    withToolChapters: inputs.usesTools,
  });

  await startOutlines({ context, courses, firstSkillId, forGuest: inputs.isGuest });

  await goalProgressStep({ entityId: goalId, status: "started", step: "outlineCourses" });

  return { courseIdsByKey, idsByKey };
}

type SavingCurriculum = {
  saved: Promise<SavedCurriculum>;
  skillIds: Promise<Record<string, string>>;
};

function saveBuiltGraph({
  built,
  context,
  inputs,
  scope,
}: {
  built: BuiltGraph;
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}): SavingCurriculum {
  const { goal, startedCourse } = inputs;
  const { graph, provenance } = built;

  const slices = toSlices(graph.skills).map((skills) =>
    saveGoalSkillsStep({ ...context, provenance, scope, skills }),
  );

  const skillIds = Promise.all(slices).then((saved) =>
    Object.fromEntries(saved.flatMap((slice) => Object.entries(slice))),
  );

  const courseIds = startedCourse
    ? Promise.resolve(toStartedCourseIds({ course: startedCourse, graph }))
    : findGoalCourses({
        ...context,
        courses: orderGoalCourses(graph),
        goal,
        product: inputs.product,
        provenance,
        resolved: built.courseIdsByKey,
        scope,
      });

  return { saved: saveCurriculum({ courseIds, goalId: goal.id, graph, slices }), skillIds };
}

type PreparedCurriculum = SavingCurriculum & { built: BuiltGraph; reused: boolean };

function toReused(curriculum: BuiltCurriculum): PreparedCurriculum {
  return {
    built: curriculum,
    reused: true,
    saved: Promise.resolve(curriculum),
    skillIds: Promise.resolve(curriculum.idsByKey),
  };
}

async function prepareCurriculum({
  context,
  inputs,
  rebuild,
  researchId,
  scope,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  rebuild: boolean;
  researchId?: string | null;
  scope: CurriculumScope;
}): Promise<PreparedCurriculum> {
  const reused = rebuild ? null : await reuseCurriculumStep({ inputs, scope });

  if (reused) {
    await goalProgressStep({ entityId: inputs.goal.id, status: "started", step: "saveSkills" });
    return toReused(reused);
  }

  const built = pinStartedCourse({
    built: await buildGraph({ context, inputs, researchId, scope }),
    startedCourse: inputs.startedCourse,
  });

  await goalProgressStep({ entityId: inputs.goal.id, status: "started", step: "saveSkills" });

  const saving = saveBuiltGraph({ built, context, inputs, scope });
  const { courseIdsByKey, idsByKey } = await saving.saved;

  // Claimed before the plan, so learners who answered the same at once plan from one graph.
  const kept = await claimLanguageGraphStep({
    courseIdsByKey,
    graph: built.graph,
    idsByKey,
    inputs,
    provenance: built.provenance,
    scope,
  });

  return kept ? toReused(kept) : { built, reused: false, ...saving };
}

/**
 * After the plan commits, so the goal already follows its courses when the update checks for a
 * learner. The goal doesn't wait for it.
 */
export async function buildCurriculum({
  context,
  inputs,
  rebuild,
  researchId,
  scope,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  rebuild: boolean;
  researchId?: string | null;
  scope: CurriculumScope;
}): Promise<BuiltCurriculum> {
  const goalId = inputs.goal.id;

  const { built, reused, saved, skillIds } = await prepareCurriculum({
    context,
    inputs,
    rebuild,
    researchId,
    scope,
  });

  // A language graph's new skills get their levels; a failed start leaves them to the daily sweep.
  if (!reused && inputs.goal.kind === "language") {
    await Promise.allSettled([
      startOnce(
        skillLevelsWorkflow,
        [{ analytics: context.analytics, skillIds: Object.values(await skillIds), wait: "soon" }],
        getSkillLevelsToken(context.workflowRunId),
      ),
    ]);
  }

  const waitsForNotice = !rebuild && isBuiltBeforeResearch({ inputs, researchId });

  const written = await createPlanAndOutlines({
    built,
    context,
    inputs,
    reused,
    saved,
    scope,
    waitsForNotice,
  });

  await updateCoursesBehind([...new Set(Object.values(written.courseIdsByKey))]);

  // Placement invalidates plan inputs, so it starts only after the initial plan commits.
  if (!rebuild) {
    await prepareGraphPlacement({
      context,
      everySkill: inputs.ownMaterialTest,
      goalId,
      graph: built.graph,
      knownAreas: inputs.knownSubjects,
      ownLevel: inputs.graphPrompt.ownLevel ?? null,
      skillIds,
      waitsForNotice: waitsForNotice && inputs.goal.kind === "exam",
    });
  }

  return { ...built, ...written };
}
