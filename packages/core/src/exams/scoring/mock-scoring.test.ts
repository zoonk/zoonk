import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getMockScoring, getScoreNotes } from "./mock-scoring";

function scoredBy(method: NonNullable<ExamStructure["mock"]>["scoring"]["method"]): ExamStructure {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method },
      sections: [],
      timeLimitMinutes: null,
      totalQuestions: null,
    },
    rules: [],
    subjects: [],
  };
}

function exam(name: string) {
  return { blueprint: { identityKey: name.toLowerCase(), name }, goal: null };
}

describe(getMockScoring, () => {
  it("scores ENEM's mocks with item response theory on its own scale", () => {
    expect(getMockScoring({ ...exam("ENEM"), structure: scoredBy("itemResponseTheory") })).toBe(
      "irt",
    );
  });

  it("counts right answers for every other exam scored with item response theory", () => {
    for (const name of ["Saber 11", "SAT"]) {
      expect(getMockScoring({ ...exam(name), structure: scoredBy("itemResponseTheory") })).toBe(
        "raw",
      );
    }
  });

  it("scores net where a wrong answer costs points, and right answers otherwise", () => {
    expect(getMockScoring({ ...exam("Cebraspe"), structure: scoredBy("wrongCancelsRight") })).toBe(
      "net",
    );

    expect(getMockScoring({ ...exam("OAB"), structure: scoredBy("raw") })).toBe("raw");
    expect(getMockScoring({ ...exam("Unicamp"), structure: scoredBy("scaled") })).toBe("raw");
    expect(getMockScoring({ ...exam("Class test"), structure: null })).toBe("raw");
  });
});

const NAMES = { blueprint: null, goal: { title: "Exam" } };

describe(getScoreNotes, () => {
  it("says when the real result depends on everyone in the sitting", () => {
    const structure = scoredBy("scaled");

    const relative = structure.mock && {
      ...structure.mock,
      scoring: {
        description: "Nota padronizada: 500 + 100z",
        method: "scaled" as const,
        relative: true,
      },
    };

    expect(
      getScoreNotes({
        ...NAMES,
        scoring: "raw",
        share: null,
        structure: { ...structure, mock: relative },
      }),
    ).toStrictEqual({ noticeScoring: "Nota padronizada: 500 + 100z", relative: true, scale: null });
  });

  it("gives the notice's own sentence where a mock can't score the exam its way", () => {
    const saber = scoredBy("itemResponseTheory");

    const described = saber.mock && {
      ...saber.mock,
      scoring: {
        description: "Puntaje de 0 a 100 por prueba con TRI",
        method: "itemResponseTheory" as const,
      },
    };

    expect(
      getScoreNotes({
        ...NAMES,
        scoring: "raw",
        share: 0.5,
        structure: { ...saber, mock: described },
      }),
    ).toStrictEqual({
      noticeScoring: "Puntaje de 0 a 100 por prueba con TRI",
      relative: false,
      scale: null,
    });

    expect(
      getScoreNotes({
        ...NAMES,
        scoring: "irt",
        share: 0.5,
        structure: { ...saber, mock: described },
      }),
    ).toStrictEqual({ noticeScoring: null, relative: false, scale: null });

    expect(
      getScoreNotes({
        ...NAMES,
        scoring: "net",
        share: 0.5,
        structure: scoredBy("wrongCancelsRight"),
      }),
    ).toStrictEqual({ noticeScoring: null, relative: false, scale: null });
  });

  it("puts the right answers on the notice's scale where it publishes the map, else says the range", () => {
    const exani = scoredBy("scaled");

    const scaled = (fromPercent: { base: number; perPercent: number } | null) => ({
      ...exani,
      mock: exani.mock && {
        ...exani.mock,
        scoring: {
          description: "Índice Ceneval de 700 a 1300",
          method: "scaled" as const,
          scale: {
            fromPercent,
            max: 1300,
            min: 700,
            name: "Índice Ceneval",
            passScore: 1000,
            step: 1,
          },
        },
      },
    });

    const scale = { max: 1300, min: 700, name: "Índice Ceneval", passScore: 1000 };

    expect(
      getScoreNotes({
        ...NAMES,
        scoring: "raw",
        share: 0.62,
        structure: scaled({ base: 700, perPercent: 6 }),
      }),
    ).toStrictEqual({ noticeScoring: null, relative: false, scale: { ...scale, score: 1072 } });

    expect(
      getScoreNotes({ ...NAMES, scoring: "raw", share: 0.62, structure: scaled(null) }),
    ).toStrictEqual({ noticeScoring: null, relative: false, scale: { ...scale, score: null } });

    expect(
      getScoreNotes({
        blueprint: { identityKey: "sat", name: "SAT" },
        goal: null,
        scoring: "raw",
        share: 0.75,
        structure: scoredBy("scaled"),
      }).scale,
    ).toStrictEqual({ max: 1600, min: 400, name: null, passScore: null, score: 1300 });
  });
});
