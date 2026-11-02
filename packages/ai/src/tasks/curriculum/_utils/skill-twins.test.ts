import { describe, expect, it } from "vitest";
import { type SkillGraph } from "./normalize-skill-graph";
import { findTwinCandidates, mergeSkillTwins } from "./skill-twins";

type GraphSkill = SkillGraph["skills"][number];

function skill(overrides: Partial<GraphSkill> & { key: string; name: string }): GraphSkill {
  return {
    area: "Língua Portuguesa",
    course: "portugues",
    description: `${overrides.name}.`,
    estimatedLessons: 3,
    examWeight: 3,
    level: "intermediate",
    outcome: false,
    phase: 1,
    prerequisites: [],
    topics: [],
    ...overrides,
  };
}

describe(findTwinCandidates, () => {
  it("asks about earlier skills of the same area whose names act on the same thing", () => {
    const skills = [
      skill({ key: "graficos", name: "Interpretar gráficos e tabelas" }),
      skill({ key: "generos", name: "Distinguir tipos e gêneros textuais" }),
      skill({ key: "ler", name: "Ler e comparar dados em gráficos e tabelas" }),
      skill({ key: "coesao", name: "Analisar a coesão do texto" }),
      skill({ area: "Matemática", key: "estatistica", name: "Ler gráficos de barras" }),
      skill({ key: "textos", name: "Classificar gêneros textuais" }),
    ];

    expect(
      findTwinCandidates(skills).map(({ siblings, skill: asked }) => [
        asked.key,
        siblings.map((sibling) => sibling.key),
      ]),
    ).toStrictEqual([
      ["ler", ["graficos"]],
      ["textos", ["generos"]],
    ]);
  });
});

describe(mergeSkillTwins, () => {
  const graph: SkillGraph = {
    courses: [{ key: "portugues", levels: ["intermediate"], title: "Português" }],
    estimatedHours: 1.2,
    phases: [
      { estimatedHours: 0.6, milestone: "Ler", title: "Base" },
      { estimatedHours: 0.6, milestone: "Escrever", title: "Escrita" },
    ],
    skills: [
      skill({ key: "graficos", name: "Interpretar gráficos e tabelas", topics: ["1 Gráficos"] }),
      skill({ key: "coesao", name: "Analisar a coesão do texto", prerequisites: ["graficos"] }),
      skill({
        key: "ler",
        name: "Ler e comparar dados em gráficos e tabelas",
        outcome: true,
        phase: 2,
        prerequisites: ["coesao"],
        topics: ["2 Tabelas"],
      }),
      skill({ key: "resumo", name: "Resumir textos", phase: 2, prerequisites: ["ler"] }),
    ],
  };

  it("keeps a graph without twins as it is", () => {
    expect(mergeSkillTwins({ graph, twins: new Map() })).toBe(graph);
  });

  it("merges a twin into the earlier skill, which takes its edges, topics and outcome", () => {
    const merged = mergeSkillTwins({ graph, twins: new Map([["ler", "graficos"]]) });

    expect(merged.skills.map((item) => [item.key, item.prerequisites])).toStrictEqual([
      ["graficos", []],
      ["coesao", ["graficos"]],
      ["resumo", ["graficos"]],
    ]);

    // The twin needed the skill that needs it: that edge would close a loop, so it goes.
    expect(merged.skills[0]).toMatchObject({ outcome: true, topics: ["1 Gráficos", "2 Tabelas"] });
    expect(merged.estimatedHours).toBe(0.9);
    expect(merged.phases.map((phase) => phase.estimatedHours)).toStrictEqual([0.6, 0.3]);
  });
});
