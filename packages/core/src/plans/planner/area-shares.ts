import { getSkillArea } from "./graph-areas";
import { type PlanGraph } from "./plan-state";

function lessonsOf(skills: PlanGraph["skills"]): number {
  return skills.reduce((sum, skill) => sum + skill.lessons, 0);
}

function averageWeight(skills: PlanGraph["skills"]): number {
  const lessons = lessonsOf(skills);
  const mass = skills.reduce((sum, skill) => sum + (skill.weight ?? 1) * skill.lessons, 0);

  return lessons > 0 ? mass / lessons : 1;
}

export function weighGraphByAreaShares({
  graph,
  shares,
}: {
  graph: PlanGraph;
  shares: ReadonlyMap<string, number> | null;
}): PlanGraph {
  if (!shares || shares.size === 0) {
    return graph;
  }

  const byArea = Map.groupBy(graph.skills, (skill) => getSkillArea({ graph, skill }));
  const shared = [...byArea].filter(([area]) => shares.has(area));

  const mass = shared.reduce(
    (sum, [, skills]) => sum + averageWeight(skills) * lessonsOf(skills),
    0,
  );

  const shareMass = shared.reduce(
    (sum, [area, skills]) => sum + (shares.get(area) ?? 0) * lessonsOf(skills),
    0,
  );

  if (mass <= 0 || shareMass <= 0) {
    return graph;
  }

  const factors = new Map(
    shared.map(([area, skills]) => [
      area,
      ((shares.get(area) ?? 0) * (mass / shareMass)) / averageWeight(skills),
    ]),
  );

  return {
    ...graph,
    skills: graph.skills.map((skill) => {
      const factor = factors.get(getSkillArea({ graph, skill }));
      return factor === undefined ? skill : { ...skill, weight: (skill.weight ?? 1) * factor };
    }),
  };
}
