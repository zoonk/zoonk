import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectShare } from "./exam-map";

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
  return { citation, format: null, part: name, points, questions, wrongPenalty: null };
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
});
