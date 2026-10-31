import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectPoints } from "../../library/exams/subject-points";
import { buildExamMap, getSubjectShare } from "./exam-map";

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

describe(getSubjectShare, () => {
  it("shares the exam's questions counting each question once, a choice's options included", () => {
    const shares = enem.subjects.map((item) => getSubjectShare({ structure: enem, subject: item }));
    expect(shares).toStrictEqual([0.5, 5 / 90, 5 / 90, 0.5]);
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

function shareOf(structure: ExamStructure) {
  return structure.subjects.map((item) => getSubjectShare({ structure, subject: item }));
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

    const shares = shareOf(structure);

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

    expect(shareOf(structure)).toStrictEqual([0.4, 0.2, 0.1, 0.1, 0.1, 0.1]);
  });

  it("keeps the weight the notice states", () => {
    const structure = scored({
      scoring: { marking: [row("Português", 4), row(null, 2)] },
      subjects: [subject("Português", 10, { weight: 0.25 }), subject("Matemática", 10)],
    });

    expect(shareOf(structure)[0]).toBe(0.25);
  });
});

describe("written test weights", () => {
  it("weighs a whole written test by its stated maximum without a question count", () => {
    const structure = scored({
      scoring: { parts: [{ ...part("P4", 1), maxPoints: 100, questions: null }] },
      subjects: [subject("Objective", 100), ...grouped("P4", ["Prova discursiva"])],
    });

    expect(shareOf(structure)).toStrictEqual([0.5, 0.5]);
  });

  it("shares a written paper's maximum among its written subjects", () => {
    const structure = scored({
      scoring: { parts: [{ ...part("P4", 1), maxPoints: 100, questions: null }] },
      subjects: [subject("Objective", 100), ...grouped("P4", ["Essay", "Redação"])],
    });

    expect(shareOf(structure)).toStrictEqual([0.5, 0.25, 0.25]);
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
