import "server-only";
import { type Plan, type TransactionClient } from "@zoonk/db";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { type PlanGraphSkill, parsePlanGraph } from "../../plans/planner/plan-state";

/**
 * The plan's graph skills under the skills its items point at. A merge moves the items but leaves
 * the graph until the next re-plan, which plans a survivor with the lessons of every skill merged
 * into it, so each merged skill keeps its size and counts it for its survivor.
 */
export async function loadGraphSkills(
  graph: Plan["graph"],
  db: TransactionClient,
): Promise<PlanGraphSkill[]> {
  const { skills } = parsePlanGraph(graph);

  const survivorOf = await loadSkillSurvivors(
    skills.map((skill) => skill.skillId),
    db,
  );

  return skills.map((skill) => ({ ...skill, skillId: survivorOf(skill.skillId) }));
}
