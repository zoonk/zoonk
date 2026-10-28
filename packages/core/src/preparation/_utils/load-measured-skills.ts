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

/**
 * One of the goal's skills as preparation measures it: its area, its section of the skill graph
 * (see `PreparationSkill.section`), and the skills whose answers show it (itself and the finer
 * skills its lessons teach).
 */
export type MeasuredSkill = Pick<GoalSkillNode, "areaId" | "memberSkillIds"> & {
  section: string | null;
  skillId: string;
};

/** A lesson's finer skills inherit its graph skill's subject, including a merged graph skill. */
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

/**
 * The whole goal's skills: the plan's, then the ones of its skill graph the plan leaves out for now
 * (no time for them yet), so taking them in later never changes what preparation is out of. Areas
 * the learner took out of the plan aren't part of the goal anymore.
 */
export async function loadMeasuredSkills({
  goalId,
  readPlan,
  savedPlan,
}: {
  goalId: string;
  readPlan: PlanReader;
  /** A page's saved plan (`readSavedPlan`), so it isn't read again. */
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
  // A page's saved plan comes with its reads taking the Library's rows from the shared caches.
  const survivorOf = await readSurvivorOf(
    graph.skills.map((skill) => skill.skillId),
    savedPlan === undefined ? prisma : "shared",
  );

  const graphSections = new Map(
    graph.skills.map((skill) => [survivorOf(skill.skillId), getSkillArea({ graph, skill })]),
  );

  // A finer skill takes its first plan item's subject. Resolve graph anchors before inheriting:
  // retained lessons can name a merged anchor or a subject named only by the graph's phase.
  const sectionOf = new Map([
    ...plan.items
      .toReversed()
      .flatMap((item) => getItemSkillSections({ item, sections: graphSections })),
    ...graphSections,
  ]);

  // Finished items survive replanning, including those of a subject the learner removed. Its
  // finer lesson skills inherit the item's subject, so they must leave the measure too.
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
