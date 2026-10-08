import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { type PlanGraph, parsePlanGraph } from "../../plans/planner/plan-state";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];

/** The skill graph a stored plan stands for, and the Library ids its keys are. */
export type PlanSkillGraph = {
  courseIdsByKey: Record<string, string>;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
  /** When the plan was built: research that started later never shaped it. */
  plannedAt: Date | null;
  provenance: { generatedAt: string; model: string; promptVersion: string; runId: string };
};

type SkillRow = { description: string; id: string; level: CourseLevel | null };

const MINUTES_PER_HOUR = 60;

/** Study time for skills, at the graph's size of a lesson. */
function toHours(skills: PlanGraph["skills"]): number {
  const lessons = skills.reduce((total, skill) => total + skill.lessons, 0);
  return (lessons * DEFAULT_LESSON_MINUTES) / MINUTES_PER_HOUR;
}

/**
 * One graph skill per course the plan learns it in, so the plan made from it keeps them all: the
 * first keyed by the skill's id, which its dependents name as their prerequisite.
 */
function toGraphSkills({
  prerequisites,
  rows,
  skill,
}: {
  prerequisites: ReadonlyMap<string, string[]>;
  rows: ReadonlyMap<string, SkillRow>;
  skill: PlanGraph["skills"][number];
}): GraphSkill[] {
  const courseIds = skill.courseIds?.length ? skill.courseIds : [""];
  const row = rows.get(skill.skillId);

  return courseIds.map((courseId, index) => ({
    area: skill.area ?? "",
    course: courseId,
    description: row?.description ?? skill.name,
    estimatedLessons: skill.lessons,
    examWeight: skill.weight,
    key: index === 0 ? skill.skillId : `${skill.skillId}:${courseId}`,
    level: row?.level ?? "beginner",
    name: skill.name,
    outcome: skill.outcome ?? false,
    phase: skill.phase + 1,
    prerequisites: prerequisites.get(skill.skillId) ?? [],
    topics: skill.topics ?? [],
  }));
}

/**
 * The skill graph a goal's stored plan was made from, rebuilt from the plan and the Library: for
 * a reading of the exam's notice that lands after the run that built the plan ended (research
 * restarted), which is checked against the plan as the first build's would have been. Keys are
 * the skills' Library ids (with the course when a skill is learned in several), so the plan the
 * graph turns back into is the same one. Null when the goal has no plan with skills.
 *
 * This is a workflow bridge: the goal comes from a run the learner's request started.
 */
export async function loadPlanSkillGraph(goalId: string): Promise<PlanSkillGraph | null> {
  const plan = await prisma.plan.findUnique({ where: { goalId } });
  const planGraph = parsePlanGraph(plan?.graph);

  if (!plan || planGraph.skills.length === 0) {
    return null;
  }

  const skillIds = planGraph.skills.map((skill) => skill.skillId);
  const courseIds = [...new Set(planGraph.skills.flatMap((skill) => skill.courseIds ?? []))];

  const [rows, edges, courses] = await Promise.all([
    prisma.skill.findMany({
      select: { description: true, id: true, level: true },
      where: { id: { in: skillIds } },
    }),
    prisma.skillPrerequisite.findMany({
      select: { prerequisiteId: true, skillId: true },
      where: { prerequisiteId: { in: skillIds }, skillId: { in: skillIds } },
    }),
    prisma.course.findMany({ select: { id: true, title: true }, where: { id: { in: courseIds } } }),
  ]);

  const prerequisites = new Map(
    [...Map.groupBy(edges, (edge) => edge.skillId)].map(([skillId, list]) => [
      skillId,
      list.map((edge) => edge.prerequisiteId),
    ]),
  );

  const byId = new Map(rows.map((row) => [row.id, row]));

  const skills = planGraph.skills.flatMap((skill) =>
    toGraphSkills({ prerequisites, rows: byId, skill }),
  );

  return {
    courseIdsByKey: Object.fromEntries(courseIds.map((id) => [id, id])),
    graph: {
      courses: courses.map((course) => ({ key: course.id, levels: [], title: course.title })),
      estimatedHours: toHours(planGraph.skills),
      phases: planGraph.phases.map((phase, index) => ({
        estimatedHours: toHours(planGraph.skills.filter((skill) => skill.phase === index)),
        milestone: phase.milestone ?? "",
        title: phase.name,
      })),
      skills,
    },
    // A key is its skill's id, followed by a course for the skill's other courses.
    idsByKey: Object.fromEntries(skills.map((skill) => [skill.key, skill.key.split(":")[0] ?? ""])),
    plannedAt: plan.generatedAt,
    provenance: {
      generatedAt: (plan.generatedAt ?? plan.createdAt).toISOString(),
      model: plan.model ?? "",
      promptVersion: plan.promptVersion ?? "",
      runId: plan.runId ?? "",
    },
  };
}
