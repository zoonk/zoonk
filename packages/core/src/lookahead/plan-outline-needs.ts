import "server-only";
import { type Course, type Skill, prisma } from "@zoonk/db";
import { type CourseBandNeed, type CurriculumScope } from "../library/curriculum/curriculum-scope";
import { parsePlanGraph } from "../plans/planner/plan-state";

/** One course of an existing plan with the level bands its stand-ins still need outlined. */
export type PlanOutlineNeed = { bands: CourseBandNeed[]; courseId: string; scope: CurriculumScope };

type NeedSkill = Pick<Skill, "description" | "id" | "level" | "name">;

type NeedCourse = Pick<Course, "id" | "language" | "targetLanguage" | "userId" | "visibility">;

type PlanGoal = { targetLanguage: string | null; title: string };

/** A skill without a level is outlined with the course's first band. */
const DEFAULT_LEVEL: CourseBandNeed["level"] = "beginner";

/** The stand-ins' skills (plan items waiting for a lesson), in plan order, once each. */
async function loadStandIns(goalId: string) {
  const plan = await prisma.plan.findUnique({
    select: {
      goal: { select: { targetLanguage: true, title: true } },
      graph: true,
      items: {
        orderBy: { position: "asc" },
        select: { skillId: true },
        where: { kind: "lesson", lessonId: null, skillId: { not: null }, status: "todo" },
      },
    },
    where: { goalId },
  });

  const skillIds = (plan?.items ?? []).flatMap((item) => (item.skillId ? [item.skillId] : []));

  return plan ? { goal: plan.goal, graph: plan.graph, skillIds: [...new Set(skillIds)] } : null;
}

/** The Library course each plan skill takes its lessons from. */
function readSkillCourses(graph: unknown): Map<string, string> {
  return new Map(
    parsePlanGraph(graph).skills.flatMap((skill) => {
      const [courseId] = skill.courseIds ?? [];
      return courseId ? [[skill.skillId, courseId] as const] : [];
    }),
  );
}

/** Level bands in the order the learner reaches their first stand-in. */
function toBands(skills: readonly NeedSkill[]): CourseBandNeed[] {
  const byLevel = Map.groupBy(skills, (skill) => skill.level ?? DEFAULT_LEVEL);

  return [...byLevel.entries()].map(([level, bandSkills]) => ({
    level,
    skills: bandSkills.map(({ description, id, name }) => ({ description, id, key: id, name })),
  }));
}

function toScope({ course, goal }: { course: NeedCourse; goal: PlanGoal }): CurriculumScope {
  const ownerId = course.visibility === "private" ? course.userId : null;

  return {
    generalGoal: ownerId ? null : goal.title,
    language: course.language,
    ownerId,
    targetLanguage: course.targetLanguage ?? goal.targetLanguage,
  };
}

/**
 * The outlines an existing plan still needs before its stand-ins become lessons: a plan started
 * from a plan link or a course keeps the Library courses it came with, and only the level bands
 * those courses haven't outlined for its skills are written, the course and band the learner
 * reaches first first. Courses keep their own language and owner; a shared course's outline sees
 * only the goal's title.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function listPlanOutlineNeeds(goalId: string): Promise<PlanOutlineNeed[]> {
  const standIns = await loadStandIns(goalId);

  if (!standIns || standIns.skillIds.length === 0) {
    return [];
  }

  const courseOf = readSkillCourses(standIns.graph);
  const courseIds = [...new Set(standIns.skillIds.flatMap((id) => courseOf.get(id) ?? []))];

  const [skills, courses] = await Promise.all([
    prisma.skill.findMany({
      select: { description: true, id: true, level: true, name: true },
      where: { id: { in: standIns.skillIds } },
    }),
    prisma.course.findMany({
      select: { id: true, language: true, targetLanguage: true, userId: true, visibility: true },
      where: { id: { in: courseIds } },
    }),
  ]);

  const ordered = standIns.skillIds.flatMap((id) => skills.find((skill) => skill.id === id) ?? []);

  return courseIds.flatMap((courseId) => {
    const course = courses.find((row) => row.id === courseId);
    const bands = toBands(ordered.filter((skill) => courseOf.get(skill.id) === courseId));

    return course && bands.length > 0
      ? [{ bands, courseId, scope: toScope({ course, goal: standIns.goal }) }]
      : [];
  });
}
