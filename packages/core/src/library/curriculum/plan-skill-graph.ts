import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { joinOptionSkills } from "../../plans/planner/option-skills";
import { type PlanGraph, parsePlanGraph } from "../../plans/planner/plan-state";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { type PlannedSkillGraph } from "./goal-plan-graph";

type GraphSkill = PlannedSkillGraph["skills"][number];

export type PlanSkillGraph = {
  courseIdsByKey: Record<string, string>;
  graph: PlannedSkillGraph;
  idsByKey: Record<string, string>;
  plannedAt: Date | null;
  provenance: { generatedAt: string; model: string; promptVersion: string; runId: string };
};

type SkillRow = { description: string; id: string; level: CourseLevel | null };

const MINUTES_PER_HOUR = 60;

function toHours(skills: PlanGraph["skills"]): number {
  const lessons = skills.reduce((total, skill) => total + skill.lessons, 0);
  return (lessons * DEFAULT_LESSON_MINUTES) / MINUTES_PER_HOUR;
}

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
    ...(skill.outlined ? { outlined: true } : {}),
    phase: skill.phase + 1,
    prerequisites: prerequisites.get(skill.skillId) ?? [],
    topics: skill.topics ?? [],
    ...(skill.topics ? {} : { topicsUnknown: true }),
  }));
}

type GraphProvenance = PlanSkillGraph["provenance"];

export async function buildPlanSkillGraph({
  graph,
  plannedAt,
  provenance,
}: {
  graph: unknown;
  plannedAt: Date | null;
  provenance: GraphProvenance;
}): Promise<PlanSkillGraph | null> {
  const planGraph = joinOptionSkills(parsePlanGraph(graph));

  if (planGraph.skills.length === 0) {
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
      ...(planGraph.courseOutline && { courseOutline: planGraph.courseOutline }),
      courses: courses.map((course) => ({ key: course.id, levels: [], title: course.title })),
      estimatedHours: toHours(planGraph.skills),
      phases: planGraph.phases.map((phase, index) => ({
        estimatedHours: toHours(planGraph.skills.filter((skill) => skill.phase === index)),
        milestone: phase.milestone ?? "",
        title: phase.name,
      })),
      skills,
    },
    idsByKey: Object.fromEntries(skills.map((skill) => [skill.key, skill.key.split(":")[0] ?? ""])),
    plannedAt,
    provenance,
  };
}

/** Internal workflow bridge: the goal must come from the learner's authorized run. */
export async function loadPlanSkillGraph(goalId: string): Promise<PlanSkillGraph | null> {
  const plan = await prisma.plan.findUnique({ where: { goalId } });

  if (!plan) {
    return null;
  }

  return buildPlanSkillGraph({
    graph: plan.graph,
    plannedAt: plan.generatedAt,
    provenance: {
      generatedAt: (plan.generatedAt ?? plan.createdAt).toISOString(),
      model: plan.model ?? "",
      promptVersion: plan.promptVersion ?? "",
      runId: plan.runId ?? "",
    },
  });
}
