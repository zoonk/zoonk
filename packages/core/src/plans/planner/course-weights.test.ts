import { describe, expect, it } from "vitest";
import { readCourseWeights, weighGraphByCourse } from "./course-weights";
import { type PlanGraph } from "./plan-state";

const NATUREZA = "Ciências da Natureza e suas Tecnologias";
const HUMANAS = "Ciências Humanas e suas Tecnologias";

const found = {
  course: "Medicina",
  edition: "SISU 2026",
  institution: "UFMG",
  source: { title: "Pesos", url: "https://ufmg.br/pesos" },
  status: "found",
  subjects: [
    { name: NATUREZA, weight: 2 },
    { name: HUMANAS, weight: 1 },
    { name: "Redação", weight: 3 },
  ],
};

function skill(skillId: string, area: string | null, weight: number | null) {
  return { area, lessons: 3, name: skillId, phase: 0, skillId, weight };
}

const graph: PlanGraph = {
  phases: [],
  skills: [
    skill("genetica", NATUREZA, 3),
    skill("brasil-colonia", HUMANAS, 3),
    skill("redacao", "Redação", null),
    skill("estrategia", "Estratégia de prova", 2),
  ],
};

describe(readCourseWeights, () => {
  it("reads the weights found for the course and institution the goal names now", () => {
    const details = { courseWeights: found, institution: "ufmg", targetCourse: "medicina" };

    expect(readCourseWeights(details)?.subjects).toHaveLength(3);
  });

  it("ignores weights for another course or institution, or that weren't found", () => {
    expect(
      readCourseWeights({ courseWeights: found, institution: "UFRJ", targetCourse: "Medicina" }),
    ).toBeNull();

    expect(
      readCourseWeights({ courseWeights: found, institution: "UFMG", targetCourse: "Direito" }),
    ).toBeNull();

    expect(
      readCourseWeights({
        courseWeights: { ...found, status: "unknown", subjects: [] },
        institution: "UFMG",
        targetCourse: "Medicina",
      }),
    ).toBeNull();

    expect(readCourseWeights({})).toBeNull();
  });
});

describe(weighGraphByCourse, () => {
  it("scales each part's skills by the course's weight relative to the parts' average", () => {
    const details = { courseWeights: found, institution: "UFMG", targetCourse: "Medicina" };
    const weighted = weighGraphByCourse({ graph, weights: readCourseWeights(details) });

    // The average weight is 2: Natureza keeps its weight, Humanas halves, the redação is 1.5 times.
    expect(weighted.skills.map((item) => item.weight)).toStrictEqual([3, 1.5, 1.5, 2]);
  });

  it("leaves the graph as it is without weights", () => {
    expect(weighGraphByCourse({ graph, weights: null })).toBe(graph);
  });
});
