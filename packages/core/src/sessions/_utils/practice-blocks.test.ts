import { describe, expect, it } from "vitest";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { getPartLabels, getPlanTopics, getPracticeLabels } from "./practice-blocks";

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

describe(getPracticeLabels, () => {
  const topics = getPlanTopics({
    goal: { kind: "learn", language: "pt", targetLanguage: null },
    graph,
  });

  it("lists a part's topics most asked first", () => {
    const asked = [{ skillId: "rent" }, { skillId: "rent" }, { skillId: "order" }];

    expect(getPracticeLabels({ items: asked, topics }).topics).toStrictEqual([
      "Alugar um apartamento",
      "Pedir comida",
    ]);
  });

  it("leads a later part of one practice with a topic an earlier part doesn't lead with", () => {
    const asked = [{ skillId: "rent" }, { skillId: "rent" }, { skillId: "order" }];

    expect(
      getPracticeLabels({ items: asked, led: ["Alugar um apartamento"], topics }).topics,
    ).toStrictEqual(["Pedir comida", "Alugar um apartamento"]);
  });

  it("keeps the lead when the part asks about nothing else", () => {
    expect(
      getPracticeLabels({ items: [{ skillId: "rent" }], led: ["Alugar um apartamento"], topics })
        .topics,
    ).toStrictEqual(["Alugar um apartamento"]);
  });
});

describe(getPartLabels, () => {
  const topics = getPlanTopics({
    goal: { kind: "learn", language: "pt", targetLanguage: null },
    graph,
  });

  it("lets the part with fewer topics keep the shared lead, so the parts read apart", () => {
    const labels = getPartLabels({
      parts: [
        [{ skillId: "rent" }, { skillId: "rent" }, { skillId: "order" }],
        [{ skillId: "rent" }],
      ],
      topics,
    });

    expect(labels.map((label) => label.topics[0])).toStrictEqual([
      "Pedir comida",
      "Alugar um apartamento",
    ]);
  });
});
