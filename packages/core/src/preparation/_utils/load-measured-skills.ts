import "server-only";
import { type Plan, prisma } from "@zoonk/db";
import {
  type GoalPlanItem,
  type GoalSkillNode,
  type loadGoalPlan,
} from "../../learner/_utils/goal-skill-graph";
import { readSurvivorOf } from "../../learner/_utils/plan-library-rows";
import { getSkillArea } from "../../plans/planner/graph-areas";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";

export type PlanReader = typeof loadGoalPlan;

export type MeasuredSkill = Pick<GoalSkillNode, "areaId" | "memberSkillIds"> & {
  section: string | null;
  skillId: string;
};

function getItemSkillSections({
  item,
  sections,
}: {
  item: GoalPlanItem;
  sections: ReadonlyMap<string, string>;
}): [string, string][] {
  const section = item.skillIds.map((id) => sections.get(id)).find(Boolean);
  return section ? item.skillIds.map((id) => [id, section]) : [];
}

export async function loadMeasuredSkills({
  goalId,
  readPlan,
  savedPlan,
}: {
  goalId: string;
  readPlan: PlanReader;
  savedPlan?: Pick<Plan, "graph" | "settings"> | null;
}) {
  const [plan, row] = await Promise.all([
    readPlan(goalId),
    savedPlan === undefined
      ? prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId } })
      : savedPlan,
  ]);

  const graph = parsePlanGraph(row?.graph);
  const { examChoices: choices, fullCourse, skippedAreas } = parsePlanSettings(row?.settings);
  const skipped = new Set(skippedAreas);
  const graphSkills = graph.skills.filter((skill) => !skipped.has(getSkillArea({ graph, skill })));

  const survivorOf = await readSurvivorOf(
    graph.skills.map((skill) => skill.skillId),
    savedPlan === undefined ? prisma : "shared",
  );

  const graphSections = new Map(
    graph.skills.map((skill) => [survivorOf(skill.skillId), getSkillArea({ graph, skill })]),
  );

  const sectionOf = new Map([
    ...plan.items
      .toReversed()
      .flatMap((item) => getItemSkillSections({ item, sections: graphSections })),
    ...graphSections,
  ]);

  const planSkills = plan.skills.filter(
    (node) => !skipped.has(sectionOf.get(node.id) ?? node.sectionTitle ?? ""),
  );

  const planned = new Set(planSkills.map((node) => node.id));

  const leftOut = graphSkills
    .map((skill) => ({
      phase: skill.phase,
      section: getSkillArea({ graph, skill }),
      skillId: survivorOf(skill.skillId),
    }))
    .filter(
      (skill, index, all) =>
        !planned.has(skill.skillId) &&
        all.findIndex((other) => other.skillId === skill.skillId) === index,
    );

  const skills: MeasuredSkill[] = [
    ...planSkills.map((node) => ({
      areaId: node.areaId,
      memberSkillIds: node.memberSkillIds,
      section: sectionOf.get(node.id) ?? node.sectionTitle,
      skillId: node.id,
    })),
    ...leftOut.map((skill) => ({
      areaId: `phase:${skill.phase}`,
      memberSkillIds: [skill.skillId],
      section: skill.section,
      skillId: skill.skillId,
    })),
  ];

  return { choices, fullCourse, graph, plan, skills, survivorOf };
}
