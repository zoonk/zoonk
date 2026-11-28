import { type PlannedSkillGraph } from "./goal-plan-graph";

type GraphSkill = PlannedSkillGraph["skills"][number];

export function toFreeKeys({
  count,
  graph,
  prefix,
}: {
  count: number;
  graph: PlannedSkillGraph;
  prefix: string;
}): string[] {
  const taken = new Set(graph.skills.map((skill) => skill.key));

  return Array.from({ length: graph.skills.length + count }, (_, index) => `${prefix}-${index + 1}`)
    .filter((key) => !taken.has(key))
    .slice(0, count);
}

/** Each addition goes right after the graph position `after` (-1 is the start), in the given order. */
export function insertGraphSkills({
  additions,
  graph,
}: {
  additions: readonly { after: number; skill: GraphSkill }[];
  graph: PlannedSkillGraph;
}): PlannedSkillGraph {
  const skills = [
    ...additions.filter((addition) => addition.after === -1).map((addition) => addition.skill),
    ...graph.skills.flatMap((skill, index) => [
      skill,
      ...additions.filter((addition) => addition.after === index).map((addition) => addition.skill),
    ]),
  ];

  return { ...graph, skills };
}
