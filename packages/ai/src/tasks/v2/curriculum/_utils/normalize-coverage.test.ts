import { describe, expect, it } from "vitest";
import { normalizeCoverage, normalizeExamWeights } from "./normalize-coverage";

const references = [
  {
    text: "Unidade 1: Razão e proporção.\nUnidade 2: Porcentagem e juros compostos.\nBibliografia: livro-texto.",
    title: "Matriz de Matemática",
  },
  { text: "Topic 4 - Reading box plots and histograms", title: "Statistics syllabus" },
];

const graphSkills = [
  { examWeight: 2, key: "ratios", name: "Resolver problemas de razão e proporção" },
  { examWeight: 4, key: "percent", name: "Calcular porcentagens" },
];

function missing(overrides: Partial<Parameters<typeof normalizeCoverage>[0]["missing"][number]>) {
  return {
    description: "Uma ideia.",
    examWeight: 3,
    name: "Calcular juros compostos",
    prerequisites: [],
    syllabusLine: "Porcentagem e juros compostos",
    ...overrides,
  };
}

describe(normalizeCoverage, () => {
  it("keeps a gap whose quoted line is in a reference and names that reference", () => {
    const result = normalizeCoverage({
      exam: false,
      graphSkills,
      missing: [missing({ prerequisites: ["percent", "invented", "percent"] })],
      references,
    });

    expect(result).toStrictEqual([
      {
        description: "Uma ideia.",
        examWeight: null,
        name: "Calcular juros compostos",
        prerequisites: ["percent"],
        reference: "Matriz de Matemática",
        syllabusLine: "Porcentagem e juros compostos",
      },
    ]);
  });

  it("matches quotes regardless of case, accents and punctuation", () => {
    const result = normalizeCoverage({
      exam: false,
      graphSkills,
      missing: [
        missing({ name: "Read box plots", syllabusLine: "reading box plots, and histograms" }),
      ],
      references,
    });

    expect(result.map((skill) => skill.reference)).toStrictEqual(["Statistics syllabus"]);
  });

  it("drops gaps with a made-up quote, a name already in the graph or a repeated name", () => {
    const result = normalizeCoverage({
      exam: false,
      graphSkills,
      missing: [
        missing({ syllabusLine: "Unidade 9: Trigonometria" }),
        missing({ name: "calcular PORCENTAGENS" }),
        missing({}),
        missing({ name: "Calcular juros compostos " }),
      ],
      references,
    });

    expect(result.map((skill) => skill.name)).toStrictEqual(["Calcular juros compostos"]);
  });

  it("keeps an exam's new skill weight as a whole number from 1 to 5", () => {
    const result = normalizeCoverage({
      exam: true,
      graphSkills,
      missing: [
        missing({ examWeight: 3.6 }),
        missing({
          examWeight: 9,
          name: "Ler boxplots",
          syllabusLine: "Reading box plots and histograms",
        }),
        missing({
          examWeight: null,
          name: "Usar a regra de três",
          syllabusLine: "Razão e proporção",
        }),
      ],
      references,
    });

    expect(result.map((skill) => skill.examWeight)).toStrictEqual([4, 5, null]);
  });
});

describe(normalizeExamWeights, () => {
  it("keeps one change per graph skill, as a whole number from 1 to 5, only when the weight moves", () => {
    const result = normalizeExamWeights({
      changes: [
        { examWeight: 5.2, key: "ratios" },
        { examWeight: 1, key: "ratios" },
        { examWeight: 4, key: "percent" },
        { examWeight: 0, key: "invented" },
      ],
      exam: true,
      graphSkills,
    });

    expect(result).toStrictEqual([{ examWeight: 5, key: "ratios" }]);
  });

  it("weighs nothing outside exams", () => {
    expect(
      normalizeExamWeights({
        changes: [{ examWeight: 5, key: "ratios" }],
        exam: false,
        graphSkills,
      }),
    ).toStrictEqual([]);
  });
});
