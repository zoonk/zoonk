import { needsCoverageCheck } from "@zoonk/core/library/curriculum/add-coverage-skills";
import {
  pinGraphToCourse,
  toStartedCourseIds,
} from "@zoonk/core/library/curriculum/course-start-graph";
import {
  groupGoalCourseBands,
  orderGoalCourses,
  splitGoalCourseBands,
  toGoalCourses,
} from "@zoonk/core/library/curriculum/goal-course-bands";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CourseBandNeed, type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { OUTLINE_AHEAD_DAYS } from "@zoonk/core/lookahead/outline-ahead";
import { start } from "workflow/api";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { isBuiltBeforeResearch, loadGoalReferences } from "./goal-content-inputs";
import { prepareGraphPlacement } from "./goal-placement-items";
import { type GoalRunContext, type SavedSlice } from "./goal-run-context";
import {
  buildSkillGraphStep,
  checkGraphCoverageStep,
  createGoalPlanStep,
  linkSkillPrerequisitesStep,
  saveGoalSkillsStep,
} from "./steps/goal-curriculum-steps";
import {
  findGoalCoursesStep,
  listPlanSkillIdsWithinStep,
  readGoalLookaheadStep,
  readPlanFirstSkillStep,
} from "./steps/goal-lookahead-steps";
import { goalProgressStep } from "./steps/goal-progress-step";
import { startNoticeWaitStep } from "./steps/notice-steps";
import { reuseCurriculumStep } from "./steps/stored-plan-steps";

/** Skills go to the Library in slices, so every step stays short and retries alone. */
const SKILL_SLICE = 12;

export function toSlices<T>(items: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / SKILL_SLICE) }, (_, index) =>
    items.slice(index * SKILL_SLICE, (index + 1) * SKILL_SLICE),
  );
}

/**
 * The goal's skill graph, checked against its references for skills they expect that it missed,
 * and, for an exam, against its notice for topics no skill teaches yet. A learn goal's graph is
 * written while research finds those references.
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

  const outline = inputs.graphPrompt.examBlueprint;

  if (!needsCoverageCheck({ graph: built.graph, outline, references })) {
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

/** One course's level bands to outline, in the order the learner reaches them. */
type OutlineCourse = { bands: CourseBandNeed[]; courseId: string; scope: CurriculumScope };

/**
 * The courses' outlines, the band the learner reaches first first. A guest's goal leaves the
 * courses' background work (their page details) to the next learner with an account whose plan
 * needs them. `background` bands are days away, so they're written at the flex tier.
 */
export async function startOutlines({
  background = false,
  context,
  courses,
  firstSkillId,
  forGuest,
}: {
  background?: boolean;
  context: GoalRunContext;
  courses: OutlineCourse[];
  firstSkillId: string | null;
  forGuest: boolean;
}) {
  await Promise.all(
    courses.map((course) =>
      start(courseOutlineWorkflow, [
        {
          ...course,
          analytics: context.analytics,
          background,
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
  waitsForNotice,
}: {
  built: BuiltGraph;
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  saved: Promise<SavedCurriculum>;
  scope: CurriculumScope;
  /** An exam's plan built before research read the notice waits for that reading from now on. */
  waitsForNotice: boolean;
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

  if (waitsForNotice) {
    await startNoticeWaitStep(goalId);
  }

  await goalProgressStep({ entityId: goalId, status: "completed", step: "createPlan" });

  const [firstSkillId, lookahead] = await Promise.all([
    readPlanFirstSkillStep(goalId),
    readGoalLookaheadStep(goalId),
  ]);

  const nearSkillIds = await listPlanSkillIdsWithinStep({
    days: lookahead.outlineDays ?? OUTLINE_AHEAD_DAYS,
    goalId,
  });

  // The learner's first lesson is always near, even in a plan with nothing scheduled yet.
  const split = splitGoalCourseBands({
    nearSkillIds: new Set([...nearSkillIds, ...(firstSkillId ? [firstSkillId] : [])]),
    needs: groupGoalCourseBands({ graph, idsByKey }),
  });

  const toOutlineCourses = (needs: typeof split.near): OutlineCourse[] =>
    toGoalCourses({
      courseIdsByKey,
      needs,
      ownerId: scope.ownerId,
      withToolChapters: inputs.usesTools,
    }).map((course) => ({ ...course, scope }));

  // Bands the plan reaches within the learner's outline window are outlined now; the rest are
  // written at the flex tier for a Plus subscriber, and left for the session preparations that
  // get close to them for everyone else, so a learner who may never come back doesn't pay for an
  // exam's every course up front.
  const outlines = { context, firstSkillId, forGuest: inputs.isGuest };

  await Promise.all([
    startOutlines({ ...outlines, courses: toOutlineCourses(split.near) }),
    lookahead.outlineDays === null
      ? startOutlines({ ...outlines, background: true, courses: toOutlineCourses(split.far) })
      : null,
  ]);

  await goalProgressStep({ entityId: goalId, status: "started", step: "outlineCourses" });

  return { courseIdsByKey, idsByKey };
}

/** What the plan is built from, once saved, and the skills' Library ids as soon as they're saved. */
type SavingCurriculum = {
  saved: Promise<SavedCurriculum>;
  /** The skills' Library ids by graph key, before their courses are found and prerequisites linked. */
  skillIds: Promise<Record<string, string>>;
};

/**
 * The skills and courses the plan is built from, saved in the Library: the graph's skills in
 * slices, their prerequisites linked, and its courses found (the course a goal started from, or
 * identity search). The skills' ids are ready before the rest, for placement's questions.
 */
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

  // The courses are found with the skills, so the plan takes each skill's lessons from its course.
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

/**
 * The goal's graph and what it's saved as: another goal's curriculum for the same exam notice when
 * one fits (`reuseCurriculumStep`), whose skills and courses the Library already has, or the
 * goal's own graph, written and saved. A rebuild reads what the learner sent, so it writes its own.
 */
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
}): Promise<SavingCurriculum & { built: BuiltGraph }> {
  const reused = rebuild ? null : await reuseCurriculumStep({ inputs, scope });

  if (reused) {
    await goalProgressStep({ entityId: inputs.goal.id, status: "started", step: "saveSkills" });

    return {
      built: reused,
      saved: Promise.resolve(reused),
      skillIds: Promise.resolve(reused.idsByKey),
    };
  }

  const built = pinStartedCourse({
    built: await buildGraph({ context, inputs, researchId, scope }),
    startedCourse: inputs.startedCourse,
  });

  await goalProgressStep({ entityId: inputs.goal.id, status: "started", step: "saveSkills" });

  return { built, ...saveBuiltGraph({ built, context, inputs, scope }) };
}

/**
 * The skill graph, its skills in the Library, the plan and the outlines of its courses, with
 * placement's questions started alongside the plan (a first build only: a rebuilt goal's learner
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
  const goalId = inputs.goal.id;

  const { built, saved, skillIds } = await prepareCurriculum({
    context,
    inputs,
    rebuild,
    researchId,
    scope,
  });

  // Placement's questions are written by a run of their own, started once the skills are saved
  // (not their courses or prerequisites, which only the plan needs): the runtime moves a run on
  // only once the steps it runs together are done, so questions written here held the plan, the
  // outlines and the first lessons until all were written.
  const waitsForNotice = !rebuild && isBuiltBeforeResearch({ inputs, researchId });

  const [written] = await Promise.all([
    createPlanAndOutlines({ built, context, inputs, saved, scope, waitsForNotice }),
    rebuild
      ? null
      : prepareGraphPlacement({
          context,
          everySkill: inputs.ownMaterialTest,
          goalId,
          graph: built.graph,
          knownAreas: inputs.knownSubjects,
          skillIds,
          waitsForNotice: waitsForNotice && inputs.goal.kind === "exam",
        }),
  ]);

  return { ...built, ...written };
}
