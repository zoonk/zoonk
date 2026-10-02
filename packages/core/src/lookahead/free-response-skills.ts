import "server-only";
import { prisma } from "@zoonk/db";
import { getExamScale } from "../exams/scoring/exam-scales";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { type PlacementItemSkill, toItemExam } from "./placement-item-skills";

/** A few questions to start: the goal's essay block asks one every few days. */
const FREE_RESPONSE_SKILLS = 3;

/**
 * The skills an AP goal gets free-response questions for: AP scores them with scoring guidelines
 * whose rows carry their own points, and College Board doesn't allow reusing its questions, so
 * they're written new, in the exam's style. They go to the plan's first phase, the most weighted
 * skills first, skipping skills that already have one for this exam (questions are shared).
 * Empty for other goals.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function pickFreeResponseSkills({
  goalId,
}: {
  goalId: string;
}): Promise<PlacementItemSkill[]> {
  const goal = await prisma.goal.findUnique({
    select: { examBlueprint: true, kind: true, plan: { select: { graph: true } }, title: true },
    where: { id: goalId },
  });

  const blueprint = goal?.kind === "exam" ? goal.examBlueprint : null;

  if (!blueprint || getExamScale({ blueprint, goal }) !== "ap") {
    return [];
  }

  const graph = parsePlanGraph(goal?.plan?.graph);
  const firstPhase = Math.min(...graph.skills.map((skill) => skill.phase));

  const ranked = graph.skills
    .filter((skill) => skill.phase === firstPhase)
    .toSorted((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .map((skill) => skill.skillId);

  const skills = await prisma.skill.findMany({
    select: { description: true, id: true, language: true, level: true, name: true, ownerId: true },
    where: {
      id: { in: ranked },
      items: { none: { examBlueprintId: blueprint.id, format: "essay" } },
    },
  });

  const exam = toItemExam(blueprint);

  return ranked
    .flatMap((id) => skills.find((skill) => skill.id === id) ?? [])
    .slice(0, FREE_RESPONSE_SKILLS)
    .map((skill) => ({ ...skill, exam }));
}
