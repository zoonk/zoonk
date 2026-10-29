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
import { type PlanSetupTask } from "@zoonk/core/plans/setup";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { isBuiltBeforeResearch, loadGoalReferences } from "./goal-content-inputs";
import { startOutlines } from "./goal-outlines";
import { prepareGraphPlacement } from "./goal-placement-items";
import { type GoalRunContext, type SavedSlice } from "./goal-run-context";
import {
  buildSkillGraphStep,
  checkGraphCoverageStep,
  linkSkillPrerequisitesStep,
  saveExamSkillGraphStep,
  saveGoalSkillsStep,
} from "./steps/goal-curriculum-steps";
import {
  findGoalCoursesStep,
  listPlanSkillIdsWithinStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";
import { createGoalPlanStep, runPlanSetupTaskStep } from "./steps/goal-plan-steps";
import { goalProgressStep } from "./steps/goal-progress-step";
import { startNoticeWaitStep } from "./steps/notice-steps";
import { mergeSkillTwinsStep } from "./steps/skill-twins-step";
import { reuseCurriculumStep } from "./steps/stored-plan-steps";

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
    buildSkillGraphStep({ ...context, inputs, scope }),
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

/** A task that still fails stays owed for the goal's next run, so this run goes on without it. */
export function setUpPlan({
  goalId,
  tasks,
}: {
  goalId: string;
  tasks: readonly PlanSetupTask[];
}): Promise<unknown> {
  return tasks.reduce<Promise<unknown>>(
    (previous, task) =>
      previous.then(() => runPlanSetupTaskStep({ goalId, task }).catch(() => null)),
    Promise.resolve(),
  );
}

type SavedCurriculum = Pick<BuiltCurriculum, "courseIdsByKey" | "idsByKey">;

async function saveCurriculum({
  courseIds,
  graph,
  slices,
}: {
  courseIds: Promise<Record<string, string>>;
  graph: BuiltGraph["graph"];
  slices: SavedSlice[];
}): Promise<SavedCurriculum> {
  const [saved, courseIdsByKey] = await Promise.all([Promise.all(slices), courseIds]);
  const idsByKey = Object.fromEntries(saved.flatMap((slice) => Object.entries(slice)));

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
  });

  if (!reused) {
    await saveExamSkillGraphStep({ courseIdsByKey, graph, idsByKey, inputs, provenance, scope });
  }

  await setUpPlan({ goalId, tasks: setupTasks });

  // The wait only shapes the reveal: once its step's retries run out, the plan goes on without it.
  if (waitsForNotice) {
    await startNoticeWaitStep(goalId).catch(() => null);
  }

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
    needs: near,
    ownerId: scope.ownerId,
    withToolChapters: inputs.usesTools,
  }).map((course) => ({ ...course, scope }));

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
    : findGoalCoursesStep({
        ...context,
        courses: orderGoalCourses(graph),
        goal,
        provenance,
        scope,
      });

  return { saved: saveCurriculum({ courseIds, graph, slices }), skillIds };
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
}): Promise<SavingCurriculum & { built: BuiltGraph; reused: boolean }> {
  const reused = rebuild ? null : await reuseCurriculumStep({ inputs, scope });

  if (reused) {
    await goalProgressStep({ entityId: inputs.goal.id, status: "started", step: "saveSkills" });

    return {
      built: reused,
      reused: true,
      saved: Promise.resolve(reused),
      skillIds: Promise.resolve(reused.idsByKey),
    };
  }

  const built = pinStartedCourse({
    built: await buildGraph({ context, inputs, researchId, scope }),
    startedCourse: inputs.startedCourse,
  });

  await goalProgressStep({ entityId: inputs.goal.id, status: "started", step: "saveSkills" });

  return { built, reused: false, ...saveBuiltGraph({ built, context, inputs, scope }) };
}

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
