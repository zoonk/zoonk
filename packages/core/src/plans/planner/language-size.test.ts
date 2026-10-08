import { describe, expect, it } from "vitest";
import { sizeLanguageGraph } from "./language-size";
import { type PlanGraph } from "./plan-state";

function graphOf(sizes: number[]): PlanGraph {
  return {
    phases: [{ milestone: null, name: "Interview" }],
    skills: sizes.map((lessons, index) => ({
      area: "English",
      lessons,
      name: `Situation ${index + 1}`,
      phase: 0,
      skillId: `s${index + 1}`,
      weight: null,
    })),
  };
}

function total(graph: PlanGraph): number {
  return graph.skills.reduce((sum, skill) => sum + skill.lessons, 0);
}

/** The lessons a three-situation graph holds, sized from one level to another. */
function sizeFrom(level: string, targetScore: string): number {
  return total(
    sizeLanguageGraph({
      details: { level, targetScore },
      graph: graphOf([8, 14, 12]),
      kind: "language",
    }),
  );
}

describe(sizeLanguageGraph, () => {
  const details = { level: "B1+", targetScore: "B2" };

  it("sizes a language goal's situations to reach the target level, each keeping its share", () => {
    const sized = sizeLanguageGraph({ details, graph: graphOf([8, 14, 12]), kind: "language" });

    expect(total(sized)).toBe(656);
    expect(sized.skills.map((skill) => skill.lessons)).toStrictEqual([154, 270, 232]);
  });

  it("counts the guided hours between the levels, half of each hour in new lessons", () => {
    // From zero to A2: 190 hours, 95 of them in 4-minute lessons.
    expect(sizeFrom("none", "A2")).toBe(1425);
    // The level onboarding stored before the level test reads as its band's lowest level.
    expect(sizeFrom("intermediate", "B2")).toBe(sizeFrom("B1", "B2"));
  });

  it("gives the same graph when sized again, so a plan saved sized keeps its size", () => {
    const once = sizeLanguageGraph({ details, graph: graphOf([8, 14, 12]), kind: "language" });

    expect(sizeLanguageGraph({ details, graph: once, kind: "language" })).toStrictEqual(once);
  });

  it("sizes only the situations the learner hasn't settled: those below their level stay out", () => {
    const sized = sizeLanguageGraph({
      details,
      graph: graphOf([8, 14, 12]),
      kind: "language",
      settledSkillIds: new Set(["s1"]),
    });

    expect(sized.skills.map((skill) => skill.lessons)).toStrictEqual([8, 353, 303]);
  });

  it("keeps other goals, and language goals without both levels or already there, as sized", () => {
    const graph = graphOf([8, 14, 12]);

    expect(sizeLanguageGraph({ details, graph, kind: "learn" })).toBe(graph);
    expect(sizeLanguageGraph({ details: { level: "B1" }, graph, kind: "language" })).toBe(graph);

    expect(sizeLanguageGraph({ details: { targetScore: "B2" }, graph, kind: "language" })).toBe(
      graph,
    );

    expect(
      sizeLanguageGraph({ details: { level: "C1", targetScore: "B2" }, graph, kind: "language" }),
    ).toBe(graph);
  });
});
