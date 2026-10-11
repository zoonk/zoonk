import { findOrCreateGoalCourse } from "@zoonk/core/library/curriculum/find-or-create-course";
import {
  getGoalCourseFormat,
  setGoalPrimaryCourse,
} from "@zoonk/core/library/curriculum/goal-primary-course";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type LearnerLookahead, getGoalLookahead } from "@zoonk/core/lookahead/learner-lookahead";
import {
  type PlanOutlineNeed,
  listPlanOutlineNeeds,
  listPlanSkillIdsWithin,
  listSoonStandInCourseIds,
} from "@zoonk/core/lookahead/plan-outline-needs";
import {
  pickPlanStartToWrite,
  pickSpeculativeLessons,
} from "@zoonk/core/lookahead/speculative-lessons";
import { type GoalKind, prisma } from "@zoonk/db";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

type OwnLevel = Parameters<typeof pickSpeculativeLessons>[0]["ownLevel"];

type CourseProvenance = Parameters<typeof findOrCreateGoalCourse>[0]["provenance"];

/**
 * The Library course behind each course the skill graph names, found through identity search or
 * created, by the graph's course key. Courses come in the order the learner reaches them, and the
 * first becomes the goal's main course. It needs only the graph, so it runs while the skills are
 * found, and the plan knows each skill's course from the start.
 */
export async function findGoalCoursesStep({
  analytics,
  courses,
  goal,
  provenance,
  scope,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  courses: { key: string; title: string }[];
  goal: { id: string; kind: GoalKind };
  /** The skill graph run that named the courses. */
  provenance: CourseProvenance;
  scope: CurriculumScope;
  workflowRunId: string;
}): Promise<Record<string, string>> {
  "use step";

  const format = getGoalCourseFormat({ kind: goal.kind, ownerId: scope.ownerId });
  const context = toContentAnalytics({ analytics, scope, workflowRunId });

  const found = await Promise.all(
    courses.map(async (need) => {
      const { course } = await withAiRetry(() =>
        findOrCreateGoalCourse({
          analytics: context,
          format,
          provenance,
          scope,
          title: need.title,
        }),
      );

      return [need.key, course.id] as const;
    }),
  );

  const [first] = found;

  if (first) {
    await setGoalPrimaryCourse({ courseId: first[1], goalId: goal.id });
  }

  return Object.fromEntries(found);
}

/** The plan's first lessons, which the learner opens first and speculative work writes ahead. */
const OPENING_LESSONS = 4;

/**
 * The lessons of the plan's opening in order, `null` for a stand-in: until the outline of the
 * band that teaches a skill lands, its item stands in for the skill.
 */
export async function readPlanOpeningStep(goalId: string): Promise<(string | null)[]> {
  "use step";

  const opening = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    take: OPENING_LESSONS,
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return opening.map((item) => item.lessonId);
}

/** The skill of the plan's first lesson: the band that teaches it is the one the learner waits on. */
export async function readPlanFirstSkillStep(goalId: string): Promise<string | null> {
  "use step";

  const first = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { skillId: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return first?.skillId ?? null;
}

/** The plan's first lesson when it may be written now (see `pickPlanStartToWrite`). */
export async function pickPlanStartToWriteStep(goalId: string): Promise<string | null> {
  "use step";

  return pickPlanStartToWrite(goalId);
}

export async function pickSpeculativeLessonsStep(input: {
  count: number;
  goalId: string;
  ownLevel: OwnLevel;
}): Promise<string[][]> {
  "use step";

  return pickSpeculativeLessons(input);
}

/**
 * The outlines a plan's stand-ins scheduled within `days` of today still need, by course and level
 * band.
 */
export async function listPlanOutlineNeedsStep(input: {
  days: number;
  goalId: string;
}): Promise<PlanOutlineNeed[]> {
  "use step";

  return listPlanOutlineNeeds(input);
}

/** The courses whose stand-ins the plan schedules within `days` of today (see the core function). */
export async function listSoonStandInCourseIdsStep(input: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  "use step";

  return listSoonStandInCourseIds(input);
}

/** How far ahead content is written for the goal's learner: a guest, a free learner or Plus. */
export async function readGoalLookaheadStep(goalId: string): Promise<LearnerLookahead> {
  "use step";

  return getGoalLookahead(goalId);
}

/** The skills the goal's plan gets to within `days` of today. */
export async function listPlanSkillIdsWithinStep(input: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  "use step";

  return listPlanSkillIdsWithin(input);
}
