import { describe, expect, it } from "vitest";
import { weighGraphByAreaShares } from "./area-shares";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";

function skill(skillId: string, attrs: Partial<PlanGraphSkill>): PlanGraphSkill {
  return { area: null, lessons: 10, name: skillId, phase: 0, skillId, weight: 3, ...attrs };
}

const graph: PlanGraph = {
  phases: [{ milestone: null, name: "Everything" }],
  skills: [
    ...Array.from({ length: 6 }, (_, index) =>
      skill(`natureza-${index}`, { area: "Natureza", weight: index === 0 ? 4 : 2 }),
    ),
    skill("humanas-0", { area: "Humanas", weight: 4 }),
    skill("humanas-1", { area: "Humanas", weight: 5 }),
    skill("strategy", { area: "Estratégia", weight: 2 }),
  ],
};

function averageWeight(weighed: PlanGraph, area: string): number {
  const own = weighed.skills.filter((item) => item.area === area);
  return own.reduce((sum, item) => sum + (item.weight ?? 0), 0) / own.length;
}

function sharedMass(from: PlanGraph): number {
  return from.skills
    .filter((item) => item.area !== "Estratégia")
    .reduce((sum, item) => sum + (item.weight ?? 0) * item.lessons, 0);
}

describe(weighGraphByAreaShares, () => {
  it("weighs subjects that share the exam alike, however many topics each has", () => {
    const shares = new Map([
      ["Natureza", 0.5],
      ["Humanas", 0.5],
    ]);

    const weighed = weighGraphByAreaShares({ graph, shares });

    expect(averageWeight(weighed, "Natureza")).toBeCloseTo(averageWeight(weighed, "Humanas"), 6);

    const [first, second] = weighed.skills;
    expect((first?.weight ?? 0) / (second?.weight ?? 1)).toBeCloseTo(2, 6);

    expect(sharedMass(weighed)).toBeCloseTo(sharedMass(graph), 6);
    expect(weighed.skills.at(-1)).toStrictEqual(graph.skills.at(-1));
  });

  it("leaves the graph as it is without shares", () => {
    expect(weighGraphByAreaShares({ graph, shares: null })).toBe(graph);
  });
});
