import "server-only";
import { SKILL_GRAPH_PROMPT_VERSION } from "@zoonk/ai/tasks/v2/curriculum/skill-graph-version";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalCurriculumInputs } from "./goal-curriculum-inputs";
import { type PlanSkillGraph, loadPlanSkillGraph } from "./plan-skill-graph";

/** The latest plans for the same notice that are checked for one that fits. */
const CANDIDATE_PLANS = 10;

/** A curriculum another goal built, with the course that goal's plan opens with. */
export type ReusableCurriculum = PlanSkillGraph & { primaryCourseId: string | null };

/**
 * What the learner said that shapes an exam's skill graph beyond its notice: the level they gave,
 * and answers to follow-up questions, which a graph written for someone else wouldn't read.
 */
function toGraphAnswers(details: unknown): { followUps: number; level: string | null } {
  const values = isJsonObject(details) ? details : {};

  return {
    followUps: Array.isArray(values.followUps) ? values.followUps.length : 0,
    level: typeof values.level === "string" ? values.level : null,
  };
}

/**
 * Only an exam read from its notice, for shared content, has a graph that doesn't depend on who
 * asked: a goal built from the learner's material, started from a course, sized to a test days
 * away, or in a private course is written for that learner.
 */
function isReusableGoal({
  inputs,
  scope,
}: {
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}): boolean {
  return (
    inputs.goal.kind === "exam" &&
    inputs.goal.examBlueprintId !== null &&
    !inputs.hasMaterial &&
    !inputs.startedCourse &&
    !inputs.graphPrompt.lessonBudget &&
    scope.ownerId === null
  );
}

/** Whether every course of a stored graph is shared: a private course's graph is its owner's. */
async function hasOnlySharedCourses(stored: PlanSkillGraph): Promise<boolean> {
  const courseIds = Object.values(stored.courseIdsByKey);

  const privateCourses = await prisma.course.count({
    where: { id: { in: courseIds }, visibility: "private" },
  });

  return courseIds.length > 0 && privateCourses === 0;
}

/** The first of the goals, newest first, whose stored curriculum is shared. */
async function findSharedCurriculum(
  goals: readonly { id: string; primaryCourseId: string | null }[],
): Promise<ReusableCurriculum | null> {
  const [goal, ...rest] = goals;

  if (!goal) {
    return null;
  }

  const stored = await loadPlanSkillGraph(goal.id);

  if (stored && (await hasOnlySharedCourses(stored))) {
    return { ...stored, primaryCourseId: goal.primaryCourseId };
  }

  return findSharedCurriculum(rest);
}

/**
 * The curriculum another learner's goal already built for the same exam notice, to plan this goal
 * from instead of writing its skill graph again: the same notice, language and stated level, no
 * follow-up answers on either side, with the current skill graph instructions, and only shared
 * courses. Its skills and courses are already in the Library, outlined and often written, so the
 * plan, placement's questions and the first lessons come in seconds, at no cost. The newest one
 * that fits, since later plans carry what research added to the notice's coverage. Null when none
 * fits; the goal's graph is written then.
 *
 * This is a workflow bridge: the goal comes from the run its learner's request started.
 */
export async function findReusableCurriculum({
  inputs,
  scope,
}: {
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}): Promise<ReusableCurriculum | null> {
  if (!isReusableGoal({ inputs, scope })) {
    return null;
  }

  const { examBlueprintId, id, language } = inputs.goal;

  const [goal, plans] = await Promise.all([
    prisma.goal.findUnique({ select: { details: true }, where: { id } }),
    prisma.plan.findMany({
      orderBy: { generatedAt: "desc" },
      select: { goal: { select: { details: true, id: true, primaryCourseId: true } } },
      take: CANDIDATE_PLANS,
      where: {
        buildFailedAt: null,
        generatedAt: { not: null },
        goal: { examBlueprintId, id: { not: id }, kind: "exam", language },
        promptVersion: SKILL_GRAPH_PROMPT_VERSION,
      },
    }),
  ]);

  const answers = toGraphAnswers(goal?.details);

  if (answers.followUps > 0) {
    return null;
  }

  const fitting = plans
    .map((plan) => plan.goal)
    .filter((other) => {
      const theirs = toGraphAnswers(other.details);
      return theirs.followUps === 0 && theirs.level === answers.level;
    });

  return findSharedCurriculum(fitting);
}
