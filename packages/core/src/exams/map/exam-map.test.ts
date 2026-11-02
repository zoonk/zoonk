import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectPoints } from "../../library/exams/subject-points";
import { listPlanShares, listSubjectShares } from "../../library/exams/subject-shares";
import { buildExamMap } from "./exam-map";

const citation = { passage: "…", sourceId: "notice" };
const LANGUAGES = "Linguagens, Códigos e suas Tecnologias";

function subject(name: string, questions: number, extra: object = {}) {
  return { citation, name, questions, topics: [], weight: null, ...extra };
}

const option = { choiceGroup: "Língua Estrangeira", partOf: LANGUAGES };

const enem: ExamStructure = {
  formats: [],
  mock: null,
  rules: [],
  subjects: [
    subject(LANGUAGES, 45),
    subject("Língua Inglesa", 5, option),
    subject("Língua Espanhola", 5, option),
    subject("Matemática e suas Tecnologias", 45),
  ],
};

describe(listSubjectShares, () => {
  it("shares the exam's questions counting each question once, a choice's options included", () => {
    expect(listSubjectShares(enem)).toStrictEqual([0.5, 5 / 90, 5 / 90, 0.5]);
  });
});

function scored({
  scoring,
  subjects,
}: {
  scoring: Partial<NonNullable<ExamStructure["mock"]>["scoring"]>;
  subjects: ExamStructure["subjects"];
}): ExamStructure {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "wrongCancelsRight", ...scoring },
      sections: [],
      timeLimitMinutes: null,
      totalQuestions: null,
    },
    rules: [],
    subjects,
  };
}

function row(name: string | null, points: number, questions: number | null = null) {
  return { citation, format: null, part: name, points, questions, wrongPoints: null };
}

function grouped(group: string, names: string[]) {
  return names.map((name) => ({
    citation,
    group,
    name,
    questions: null,
    topics: [],
    weight: null,
  }));
}

function part(name: string, questions: number) {
  return { citation, maxPoints: null, minimum: null, name, qualifying: false, questions };
}

describe("a subject's share of the exam's points", () => {
  it("weighs a test whose questions count double double, splitting each test's points among its subjects", () => {
    const structure = scored({
      scoring: { marking: [row("P3", 2)], parts: [part("P1", 40), part("P2", 40), part("P3", 90)] },
      subjects: [
        ...grouped("P1", ["Português", "Ética", "Lógica", "Legislação"]),
        ...grouped("P2", ["Auditoria", "Controle", "Contabilidade", "Finanças", "Economia"]),
        ...grouped("P3", ["Administrativo", "Constitucional", "Correição", "Ouvidoria", "TI"]),
      ],
    });

    const shares = listSubjectShares(structure);

    expect(shares.slice(0, 4)).toStrictEqual(Array.from({ length: 4 }, () => 10 / 260));
    expect(shares.slice(4, 9)).toStrictEqual(Array.from({ length: 5 }, () => 8 / 260));
    expect(shares.slice(9)).toStrictEqual(Array.from({ length: 5 }, () => 36 / 260));
  });

  it("multiplies each subject's questions by its points", () => {
    const structure = scored({
      scoring: {
        marking: [row("Português", 4), row("Conhecimentos Específicos", 4), row(null, 2)],
      },
      subjects: [
        subject("Português", 10),
        subject("Conhecimentos Específicos", 5),
        subject("Matemática", 5),
        subject("Informática", 5),
        subject("Atualidades", 5),
        subject("Legislação", 5),
      ],
    });

    expect(listSubjectShares(structure)).toStrictEqual([0.4, 0.2, 0.1, 0.1, 0.1, 0.1]);
  });

  it("keeps the weight the notice states and shares the rest by points", () => {
    const structure = scored({
      scoring: { marking: [row("Português", 4), row(null, 2)] },
      subjects: [
        subject("Português", 10, { weight: 0.25 }),
        subject("Matemática", 10),
        subject("Física", 5),
      ],
    });

    expect(listSubjectShares(structure)).toStrictEqual([0.25, (0.75 * 20) / 30, (0.75 * 10) / 30]);
  });
});

function term(parts: string[], share: number) {
  return { citation, parts, share };
}

function withFormula(finalShares?: ReturnType<typeof term>[]): ExamStructure {
  return scored({
    scoring: {
      finalShares,
      marking: [row("P3", 2)],
      parts: [
        part("P1", 40),
        part("P2", 40),
        part("P3", 90),
        { ...part("P4", 1), maxPoints: 100, questions: null },
      ],
    },
    subjects: [
      ...grouped("P1", ["Português", "Ética"]),
      ...grouped("P2", ["Auditoria"]),
      ...grouped("P3", ["TI"]),
      ...grouped("P4", ["Prova discursiva"]),
    ],
  });
}

describe("the final score's formula", () => {
  it("adds points across tests without a formula", () => {
    expect(listSubjectShares(withFormula())).toStrictEqual([
      20 / 360,
      20 / 360,
      40 / 360,
      180 / 360,
      100 / 360,
    ]);
  });

  it("splits each term's share among its tests' subjects by their points", () => {
    const structure = withFormula([term(["P1", "P2", "P3"], 0.5), term(["P4"], 0.5)]);

    expect(listSubjectShares(structure)).toStrictEqual([
      (0.5 * 20) / 260,
      (0.5 * 20) / 260,
      (0.5 * 40) / 260,
      (0.5 * 180) / 260,
      0.5,
    ]);
  });

  it("shares what no term covers by points", () => {
    expect(listSubjectShares(withFormula([term(["P4"], 0.4)]))).toStrictEqual([
      (0.6 * 20) / 260,
      (0.6 * 20) / 260,
      (0.6 * 40) / 260,
      (0.6 * 180) / 260,
      0.4,
    ]);
  });

  it.each([
    { name: "every subject's", shares: [0.4, 0.1], weights: { Português: 0.4, Ética: 0.1 } },
    { name: "one subject's", shares: [0.4, 0.1], weights: { Português: 0.4 } },
    { name: "past the term's", shares: [0.25, 0.25], weights: { Português: 0.6 } },
  ])(
    "keeps a term's subjects at their stated weights when they fit it: $name weight",
    ({ shares, weights }) => {
      const structure = withFormula([term(["P1"], 0.5), term(["P2", "P3", "P4"], 0.5)]);

      const subjects = structure.subjects.map((item) => ({
        ...item,
        weight: weights[item.name as keyof typeof weights] ?? null,
      }));

      const [portuguese, ethics] = listSubjectShares({ ...structure, subjects });

      expect(portuguese).toBeCloseTo(shares[0] ?? 0);
      expect(ethics).toBeCloseTo(shares[1] ?? 0);
    },
  );

  it("lets a term of the final score decide over a subject's own weight that contradicts it", () => {
    const structure = withFormula([term(["P1", "P2", "P3"], 0.5), term(["P4"], 0.5)]);

    const subjects = structure.subjects.map((item) =>
      item.name === "Prova discursiva" ? { ...item, weight: 0.3 } : item,
    );

    expect(listSubjectShares({ ...structure, subjects }).at(-1)).toBe(0.5);
  });
});

type Minimum = NonNullable<ExamStructure["mock"]>["scoring"]["parts"];

function prelims(minimum: NonNullable<Minimum>[number]["minimum"]): ExamStructure {
  return scored({
    scoring: {
      parts: [
        { ...part("Paper I", 100), maxPoints: 200 },
        { ...part("Paper II", 80), maxPoints: 200, minimum, qualifying: true },
      ],
    },
    subjects: [...grouped("Paper I", ["General Studies"]), ...grouped("Paper II", ["CSAT"])],
  });
}

describe("a qualifying test", () => {
  it("counts for none of the result, so the map shows it outside the score", () => {
    const structure = prelims({ unit: "percent", value: 33 });
    const map = buildExamMap({ frequency: [], skills: [], structure });

    expect(listSubjectShares(structure)).toStrictEqual([1, 0]);

    expect(map.subjects.map((item) => [item.name, item.share])).toStrictEqual([
      ["General Studies", 1],
      ["CSAT", 0],
    ]);
  });

  it.each([
    { minimum: { unit: "percent" as const, value: 33 }, name: "a percent" },
    { minimum: { unit: "points" as const, value: 66 }, name: "points" },
  ])(
    "weighs in the plan what passing takes, its $name minimum of the half its points would have",
    ({ minimum }) => {
      const [general, aptitude] = listPlanShares(prelims(minimum));

      expect(aptitude).toBeCloseTo(0.33 * 0.5);
      expect(general).toBeCloseTo(1 - 0.33 * 0.5);
    },
  );

  it("weighs in the plan what its points would have when the notice states no minimum", () => {
    expect(listPlanShares(prelims(null))).toStrictEqual([0.5, 0.5]);
  });

  it("keeps the plan's counted shares as the result's when no test is qualifying", () => {
    const structure = withFormula([term(["P1", "P2", "P3"], 0.5), term(["P4"], 0.5)]);
    expect(listPlanShares(structure)).toStrictEqual(listSubjectShares(structure));
  });
});

describe("written test weights", () => {
  it("weighs a whole written test by its stated maximum without a question count", () => {
    const structure = scored({
      scoring: { parts: [{ ...part("P4", 1), maxPoints: 100, questions: null }] },
      subjects: [subject("Objective", 100), ...grouped("P4", ["Prova discursiva"])],
    });

    expect(listSubjectShares(structure)).toStrictEqual([0.5, 0.5]);
  });

  it("shares a written paper's maximum among its written subjects", () => {
    const structure = scored({
      scoring: { parts: [{ ...part("P4", 1), maxPoints: 100, questions: null }] },
      subjects: [subject("Objective", 100), ...grouped("P4", ["Essay", "Redação"])],
    });

    expect(listSubjectShares(structure)).toStrictEqual([0.5, 0.25, 0.25]);
  });
});

describe("mixed paper weights", () => {
  it("does not give an essay the whole maximum of a paper that includes objective subjects", () => {
    const structure = scored({
      scoring: { parts: [{ ...part("Paper", 50), maxPoints: 100 }] },
      subjects: [{ ...subject("Objective", 50), group: "Paper" }, ...grouped("Paper", ["Essay"])],
    });

    const essay = structure.subjects.find((item) => item.name === "Essay");
    expect(essay && getSubjectPoints({ structure, subject: essay })).toBe(50);
  });
});

describe("mixed paper map shares", () => {
  it.each([
    { extraPoints: 0, shares: [0.8, 0.2] },
    { extraPoints: 100, shares: [0.4, 0.1, 0.5] },
  ])(
    "uses the paper's remaining points for its essay with $extraPoints separate points",
    ({ extraPoints, shares }) => {
      const structure = scored({
        scoring: { parts: [{ ...part("Paper", 80), maxPoints: 100 }] },
        subjects: [
          { ...subject("Objective", 80), group: "Paper" },
          ...grouped("Paper", ["Essay"]),
          ...(extraPoints ? [subject("Other", extraPoints)] : []),
        ],
      });

      const map = buildExamMap({ frequency: [], skills: [], structure });

      expect(map.subjects.map((item) => item.share)).toStrictEqual(shares);

      expect(
        structure.subjects.map((item) => getSubjectPoints({ structure, subject: item })),
      ).toStrictEqual([80, 20, ...(extraPoints ? [extraPoints] : [])]);
    },
  );

  it("shares the remaining points among the paper's written subjects", () => {
    const structure = scored({
      scoring: {
        marking: [row("Objective", 2)],
        parts: [{ ...part("Paper", 40), maxPoints: 100 }],
      },
      subjects: [
        { ...subject("Objective", 40), group: "Paper" },
        ...grouped("Paper", ["Essay", "Redação"]),
      ],
    });

    const map = buildExamMap({ frequency: [], skills: [], structure });
    expect(map.subjects.map((item) => item.share)).toStrictEqual([0.8, 0.1, 0.1]);
  });

  it("uses the average known share for the essay while retaining relative objective weights", () => {
    const structure = scored({
      scoring: {},
      subjects: [subject("A", 80), subject("B", 20), ...grouped("Paper", ["Essay"])],
    });

    const map = buildExamMap({ frequency: [], skills: [], structure });
    expect(map.subjects.map((item) => item.share)).toStrictEqual([0.8 / 1.5, 0.2 / 1.5, 1 / 3]);
  });

  it("counts a choice and its nested options once when assuming an essay share", () => {
    const structure = { ...enem, subjects: [...enem.subjects, ...grouped("Written", ["Essay"])] };
    const map = buildExamMap({ frequency: [], skills: [], structure });

    expect(map.subjects.map((item) => item.share)).toStrictEqual([
      1 / 3,
      5 / 90 / 1.5,
      5 / 90 / 1.5,
      1 / 3,
      1 / 3,
    ]);
  });
});
