import { getSkillArea } from "./graph-areas";
import { type PlanGraph } from "./plan-state";

function lessonsOf(skills: PlanGraph["skills"]): number {
  return skills.reduce((sum, skill) => sum + skill.lessons, 0);
}

/** An area's skills' exam weight on average, each counting by its size. */
function averageWeight(skills: PlanGraph["skills"]): number {
  const lessons = lessonsOf(skills);
  const mass = skills.reduce((sum, skill) => sum + (skill.weight ?? 1) * skill.lessons, 0);

  return lessons > 0 ? mass / lessons : 1;
}

/**
 * The graph with each area's skills' exam weights scaled so the area's average weight follows its
 * share of the exam (`shares`, see `getAreaShares`), its skills keeping their weights relative to
 * each other, and the plan's weight in all kept. The study cycle shares the days by what areas are
 * worth on average, and the skill graph weighs each skill by its own part of the exam: a subject
 * with many small topics (ENEM's sciences, 23 contents for 45 questions) averaged less than one
 * with a few big ones (its humanities, 5 for 45) and got a fraction of their time, so most of its
 * topics didn't fit. Areas outside the notice keep their weights. The stored graph never changes:
 * only the planner reads the weighted copy.
 */
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

  // The scale that keeps the shared areas' weight in all: the shares only move it between them.
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
