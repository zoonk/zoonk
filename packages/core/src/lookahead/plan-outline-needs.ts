import "server-only";
import { type Course, type ExamBlueprint, type Goal, type Skill, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { findUntaughtSkills } from "../library/curriculum/course-outline-state";
import { type CourseBandNeed, type CurriculumScope } from "../library/curriculum/curriculum-scope";
import { toGoalCandidateExams } from "../library/exams/candidate-exams";
import { goalUsesTools } from "../plans/_utils/plan-tools";
import { addDays } from "../plans/planner/plan-calendar";
import { parsePlanGraph } from "../plans/planner/plan-state";

/** One course of an existing plan with the level bands its stand-ins still need outlined. */
export type PlanOutlineNeed = { bands: CourseBandNeed[]; courseId: string; scope: CurriculumScope };

type NeedSkill = Pick<Skill, "description" | "id" | "level" | "name">;

type NeedCourse = Pick<Course, "id" | "language" | "targetLanguage" | "userId" | "visibility">;

type PlanGoal = Pick<
  Goal,
  "examBlueprintId" | "kind" | "primaryCourseId" | "targetLanguage" | "title"
> & { examBlueprint: ExamBlueprint | null };

/** A skill without a level is outlined with the course's first band. */
const DEFAULT_LEVEL: CourseBandNeed["level"] = "beginner";

/** The last day of the plan within `days` of today in the goal's time zone. */
async function getHorizon({ days, goalId }: { days: number; goalId: string }): Promise<Date> {
  const goal = await prisma.goal.findUnique({ select: { timezone: true }, where: { id: goalId } });
  const timeZone = getAnswerTimeZone({ goal });

  return addDays(getDateInTimeZone({ date: new Date(), timeZone }), days);
}

/**
 * The stand-ins' skills (plan items waiting for a lesson), in plan order, once each; only those
 * scheduled by `until` when it's given.
 */
async function loadStandIns({ goalId, until }: { goalId: string; until: Date | null }) {
  const plan = await prisma.plan.findUnique({
    select: {
      goal: {
        select: {
          examBlueprint: true,
          examBlueprintId: true,
          kind: true,
          primaryCourseId: true,
          targetLanguage: true,
          title: true,
        },
      },
      graph: true,
      items: {
        orderBy: { position: "asc" },
        select: { skillId: true },
        where: {
          kind: "lesson",
          lessonId: null,
          skillId: { not: null },
          status: "todo",
          ...(until ? { scheduledFor: { lte: until } } : {}),
        },
      },
    },
    where: { goalId },
  });

  const skillIds = (plan?.items ?? []).flatMap((item) => (item.skillId ? [item.skillId] : []));

  return plan ? { goal: plan.goal, graph: plan.graph, skillIds: [...new Set(skillIds)] } : null;
}

/**
 * The Library course each plan skill takes its lessons from: the one its graph names, else the
 * goal's own course, where the planner learns a skill a change added (a topic the learner asked
 * for, a prerequisite) and the next chapters of a skill are written too.
 */
function readSkillCourses({
  graph,
  primaryCourseId,
}: {
  graph: unknown;
  primaryCourseId: string | null;
}): Map<string, string> {
  return new Map(
    parsePlanGraph(graph).skills.flatMap((skill) => {
      const courseId = skill.courseIds?.[0] ?? primaryCourseId;
      return courseId ? [[skill.skillId, courseId] as const] : [];
    }),
  );
}

/**
 * Level bands in the order the learner reaches their first stand-in. A goal answered without tools
 * of its own (an exam that isn't practical) has them taught in chapters without tools.
 */
function toBands({
  skills,
  withToolChapters,
}: {
  skills: readonly NeedSkill[];
  withToolChapters: boolean;
}): CourseBandNeed[] {
  const byLevel = Map.groupBy(skills, (skill) => skill.level ?? DEFAULT_LEVEL);

  return [...byLevel.entries()].map(([level, bandSkills]) => ({
    level,
    skills: bandSkills.map(({ description, id, name }) => ({ description, id, key: id, name })),
    withToolChapters,
  }));
}

function toScope({ course, goal }: { course: NeedCourse; goal: PlanGoal }): CurriculumScope {
  const ownerId = course.visibility === "private" ? course.userId : null;

  return {
    exams: ownerId ? [] : toGoalCandidateExams({ blueprint: goal.examBlueprint, kind: goal.kind }),
    generalGoal: ownerId ? null : goal.title,
    language: course.language,
    ownerId,
    targetLanguage: course.targetLanguage ?? goal.targetLanguage,
  };
}

/**
 * The outlines a plan still needs before its stand-ins become lessons, the course and band the
 * learner reaches first first: a plan started from a plan link or a course keeps the Library
 * courses it came with, and a plan whose later bands weren't outlined when it was built gets them
 * as it gets close (`days`: only stand-ins scheduled within that many days; null for all). Only
 * skills their course doesn't teach at all are listed: one it teaches in part gets its next
 * chapter from `listSkillExtensions`.
 * Courses keep their own language and owner; a shared course's outline sees only the goal's title.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function listPlanOutlineNeeds({
  days,
  goalId,
}: {
  days: number | null;
  goalId: string;
}): Promise<PlanOutlineNeed[]> {
  const until = days === null ? null : await getHorizon({ days, goalId });
  const standIns = await loadStandIns({ goalId, until });

  if (!standIns || standIns.skillIds.length === 0) {
    return [];
  }

  const courseOf = readSkillCourses({
    graph: standIns.graph,
    primaryCourseId: standIns.goal.primaryCourseId,
  });

  const courseIds = [...new Set(standIns.skillIds.flatMap((id) => courseOf.get(id) ?? []))];

  const [skills, courses, withToolChapters] = await Promise.all([
    prisma.skill.findMany({
      select: { description: true, id: true, level: true, name: true },
      where: { id: { in: standIns.skillIds } },
    }),
    prisma.course.findMany({
      select: { id: true, language: true, targetLanguage: true, userId: true, visibility: true },
      where: { id: { in: courseIds } },
    }),
    goalUsesTools(standIns.goal),
  ]);

  const ordered = standIns.skillIds.flatMap((id) => skills.find((skill) => skill.id === id) ?? []);

  const needs = await Promise.all(
    courses.map(async (course) => {
      const scope = toScope({ course, goal: standIns.goal });
      const courseSkills = ordered.filter((skill) => courseOf.get(skill.id) === course.id);

      // A skill its course teaches in part gets its next chapter as an extension instead.
      const untaught = new Set(
        await findUntaughtSkills({
          courseId: course.id,
          ownerId: scope.ownerId,
          skillIds: courseSkills.map((skill) => skill.id),
          withToolChapters,
        }),
      );

      const bands = toBands({
        skills: courseSkills.filter((skill) => untaught.has(skill.id)),
        withToolChapters,
      });

      return { bands, courseId: course.id, scope };
    }),
  );

  // Courses in the order the learner reaches their first stand-in.
  return courseIds.flatMap((courseId) =>
    needs.filter((need) => need.courseId === courseId && need.bands.length > 0),
  );
}

/**
 * The Library courses whose stand-ins (lessons not outlined yet, a skill's first chapters or its
 * next one) the plan schedules within `days` of today. Today holds their time and says more
 * lessons are on the way, so their outline isn't background work.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary loaded.
 */
export async function listSoonStandInCourseIds({
  days,
  goalId,
}: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  const until = await getHorizon({ days, goalId });
  const standIns = await loadStandIns({ goalId, until });

  if (!standIns) {
    return [];
  }

  const courseOf = readSkillCourses({
    graph: standIns.graph,
    primaryCourseId: standIns.goal.primaryCourseId,
  });

  return [...new Set(standIns.skillIds.flatMap((id) => courseOf.get(id) ?? []))];
}

/**
 * The skills the plan gets to within `days` of today: every one with a lesson or a stand-in
 * scheduled by then. A plan is built with only these skills' course bands outlined when the
 * learner's plan writes less ahead (`getLookahead`); the rest are outlined as the plan gets close.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function listPlanSkillIdsWithin({
  days,
  goalId,
}: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  const until = await getHorizon({ days, goalId });

  const items = await prisma.planItem.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: {
      kind: "lesson",
      plan: { goalId },
      scheduledFor: { lte: until },
      skillId: { not: null },
    },
  });

  return items.flatMap((item) => (item.skillId ? [item.skillId] : []));
}
