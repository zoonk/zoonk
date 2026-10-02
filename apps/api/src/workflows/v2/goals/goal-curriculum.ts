import {
  pinGraphToCourse,
  toStartedCourseIds,
} from "@zoonk/core/library/curriculum/course-start-graph";
import {
  groupGoalCourseBands,
  orderGoalCourses,
  toGoalCourses,
} from "@zoonk/core/library/curriculum/goal-course-bands";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CourseBandNeed, type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { start } from "workflow/api";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { loadGoalReferences } from "./goal-content-inputs";
import { prepareGraphPlacement } from "./goal-placement-items";
import { type GoalRunContext, type SavedSlice } from "./goal-run-context";
import {
  buildSkillGraphStep,
  checkGraphCoverageStep,
  createGoalPlanStep,
  linkSkillPrerequisitesStep,
  saveGoalSkillsStep,
} from "./steps/goal-curriculum-steps";
import { findGoalCoursesStep, readPlanFirstSkillStep } from "./steps/goal-lookahead-steps";
import { goalProgressStep } from "./steps/goal-progress-step";

/** Skills go to the Library in slices, so every step stays short and retries alone. */
const SKILL_SLICE = 12;

export function toSlices<T>(items: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / SKILL_SLICE) }, (_, index) =>
    items.slice(index * SKILL_SLICE, (index + 1) * SKILL_SLICE),
  );
}

/**
 * The goal's skill graph, checked against its references for skills they expect that it missed.
 * A learn goal's graph is written while research finds those references.
 */
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

  if (references.length === 0) {
    return built;
  }

  const { graph } = await checkGraphCoverageStep({
    ...context,
    graph: built.graph,
    prompt: inputs.graphPrompt,
    references,
    scope,
  });

  return { ...built, graph };
}

type BuiltGraph = Awaited<ReturnType<typeof buildGraph>>;

/**
 * What a first build wrote, for the reconciliation once research reads an exam's notice: the
 * graph the plan was built from, its skills' Library ids and its courses' ids by graph key.
 */
export type BuiltCurriculum = BuiltGraph & {
  courseIdsByKey: Record<string, string>;
  idsByKey: Record<string, string>;
};

/**
 * A goal started from a course nobody outlined yet learns that course: its graph's courses all
 * become the course (see `pinGraphToCourse`), so the outline is written there and the plan is
 * built from it.
 */
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

/**
 * The courses' outlines, the band the learner reaches first first. A guest's goal leaves the
 * courses' background work (their other bands and page details) to the next learner with an
 * account whose plan needs them.
 */
export async function startOutlines({
  context,
  courses,
  firstSkillId,
  forGuest,
}: {
  context: GoalRunContext;
  courses: { bands: CourseBandNeed[]; courseId: string; scope: CurriculumScope }[];
  firstSkillId: string | null;
  forGuest: boolean;
}) {
  await Promise.all(
    courses.map((course) =>
      start(courseOutlineWorkflow, [
        {
          ...course,
          analytics: context.analytics,
          forGuest,
          waitedSkillId: firstSkillId ?? undefined,
        },
      ]),
    ),
  );
}

/** What the plan is built from: the skills' Library ids and the courses' ids, by graph key. */
type SavedCurriculum = Pick<BuiltCurriculum, "courseIdsByKey" | "idsByKey">;

/** Every slice of skills saved and their prerequisites linked, with the goal's courses found. */
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

/** Once everything it's built from is saved: the plan, then the outlines. */
async function createPlanAndOutlines({
  built,
  context,
  inputs,
  saved,
  scope,
}: {
  built: BuiltGraph;
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  saved: Promise<SavedCurriculum>;
  scope: CurriculumScope;
}): Promise<SavedCurriculum> {
  const { graph, provenance } = built;
  const goalId = inputs.goal.id;
  const { courseIdsByKey, idsByKey } = await saved;

  await createGoalPlanStep({
    courseIdsByKey,
    goalId,
    graph,
    idsByKey,
    platform: context.analytics.platform ?? null,
    provenance,
  });

  await goalProgressStep({ entityId: goalId, status: "completed", step: "createPlan" });

  const firstSkillId = await readPlanFirstSkillStep(goalId);

  const courses = toGoalCourses({
    courseIdsByKey,
    needs: groupGoalCourseBands({ graph, idsByKey }),
    ownerId: scope.ownerId,
  });

  await startOutlines({
    context,
    courses: courses.map((course) => ({ ...course, scope })),
    firstSkillId,
    forGuest: inputs.isGuest,
  });

  await goalProgressStep({ entityId: goalId, status: "started", step: "outlineCourses" });

  return { courseIdsByKey, idsByKey };
}

/**
 * The skill graph, its skills in the Library, the plan and the outlines of its courses, with
 * placement's questions written alongside the plan (a first build only: a rebuilt goal's learner
 * is past placement). Returns what it wrote, so the plan can be reconciled with research later.
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
  const { goal, startedCourse } = inputs;

  const built = pinStartedCourse({
    built: await buildGraph({ context, inputs, researchId, scope }),
    startedCourse,
  });

  const { graph, provenance } = built;

  await goalProgressStep({ entityId: goal.id, status: "started", step: "saveSkills" });

  // The courses are found with the skills, so the plan takes each skill's lessons from its course.
  const slices = toSlices(graph.skills).map((skills) =>
    saveGoalSkillsStep({ ...context, provenance, scope, skills }),
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

  const saved = saveCurriculum({ courseIds, graph, slices });

  // Placement's questions start with the plan's own step, never before it: the runtime moves a
  // run on only once the steps it runs together are done, so questions still being written when
  // the plan's turn came held the plan, and placement's first question, until all were written.
  const [written] = await Promise.all([
    createPlanAndOutlines({ built, context, inputs, saved, scope }),
    rebuild ? null : prepareGraphPlacement({ context, goalId: goal.id, graph, saved }),
  ]);

  return { ...built, ...written };
}
