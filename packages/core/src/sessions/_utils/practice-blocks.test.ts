import { describe, expect, it } from "vitest";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { getPlanTopics, getPracticeLabels } from "./practice-blocks";

const graph: PlanGraph = {
  phases: [],
  skills: [
    {
      area: "Inglês americano",
      lessons: 3,
      name: "Alugar um apartamento",
      phase: 0,
      skillId: "rent",
      weight: null,
    },
    {
      area: "Inglês americano",
      lessons: 3,
      name: "Pedir comida",
      phase: 0,
      skillId: "order",
      weight: null,
    },
  ],
};

const items = [{ skillId: "rent" }, { skillId: "order" }];

describe(getPlanTopics, () => {
  it("names a language goal's practice after the language, not its course's variety", () => {
    const topics = getPlanTopics({
      goal: { kind: "language", language: "pt", targetLanguage: "en" },
      graph,
    });

    expect(getPracticeLabels({ items, topics }).areas).toStrictEqual(["Inglês"]);
  });

  it("keeps the plan's areas for other goals", () => {
    const topics = getPlanTopics({
      goal: { kind: "learn", language: "pt", targetLanguage: null },
      graph,
    });

    expect(getPracticeLabels({ items, topics }).areas).toStrictEqual(["Inglês americano"]);
  });
});
