import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listMockOptions } from "./mock-options";
import { getMockSizeSource } from "./mock-size-source";
import { toMockStructure } from "./mock-structure";

const CITATION = { passage: "From the notice.", sourceId: "notice" };

function subject(name: string, questions: number | null) {
  return { citation: CITATION, name, questions, shortName: null, topics: [], weight: null };
}

const MOCK = {
  adaptive: false,
  citations: [],
  order: null,
  scoring: { description: "", method: "raw" as const },
  sections: [
    { day: null, kind: "objective" as const, minutes: 300, name: "Prova objetiva", questions: 80 },
  ],
  timeLimitMinutes: 300,
  totalQuestions: 80,
};

/** An exam whose notice states its size, time and each subject's questions. */
const STATED: ExamStructure = {
  formats: [],
  mock: MOCK,
  rules: [],
  subjects: [subject("Direito Civil", 40), subject("Direito Penal", 40)],
};

const PAST = {
  checkedAt: "2026-10-01T00:00:00.000Z",
  edition: "42º Exame de Ordem",
  source: { title: "Folha Dirigida", url: "https://example.com/oab" },
  subjects: [
    { name: "Direito Civil", questions: 6 },
    { name: "Direito Penal", questions: 6 },
  ],
};

describe(getMockSizeSource, () => {
  it("says nothing more when the notice states the size, the time and each subject's share", () => {
    expect(
      getMockSizeSource({ noticeQuestions: null, ownerId: null, structure: STATED }),
    ).toStrictEqual({
      formats: null,
      material: false,
      pastEdition: null,
      questions: "notice",
      subjects: "notice",
      time: "notice",
    });
  });

  it("cites the past edition each subject's share follows", () => {
    const structure = {
      ...STATED,
      pastQuestions: PAST,
      subjects: [subject("Direito Civil", null), subject("Direito Penal", null)],
    };

    expect(getMockSizeSource({ noticeQuestions: null, ownerId: null, structure })).toMatchObject({
      pastEdition: { edition: "42º Exame de Ordem", title: "Folha Dirigida" },
      questions: "notice",
      subjects: "pastEdition",
    });
  });

  it("says the subjects are split evenly when nothing counts them", () => {
    const structure = {
      ...STATED,
      subjects: [subject("Direito Civil", null), subject("Direito Penal", null)],
    };

    expect(getMockSizeSource({ noticeQuestions: null, ownerId: null, structure })).toMatchObject({
      pastEdition: null,
      subjects: "even",
    });
  });

  it("takes the size from the notice's edition, and says when nothing states it or its time", () => {
    const cold = {
      ...STATED,
      mock: null,
      subjects: [subject("Direito Civil", null), subject("Direito Penal", null)],
    };

    expect(
      getMockSizeSource({ noticeQuestions: 60, ownerId: null, structure: cold }),
    ).toMatchObject({ questions: "notice", time: "unstated" });

    expect(
      getMockSizeSource({ noticeQuestions: null, ownerId: null, structure: cold }),
    ).toMatchObject({ questions: "unstated", time: "unstated" });
  });

  it("says a class test's length is the app's own when the learner's material doesn't give one", () => {
    const material = { ...STATED, mock: null, subjects: [subject("Biologia", null)] };

    expect(
      getMockSizeSource({ noticeQuestions: null, ownerId: "learner", structure: material }),
    ).toMatchObject({ material: true, questions: "unstated", subjects: null });
  });
});

describe(toMockStructure, () => {
  it("sits as many questions as the notice's edition states, never a length of its own", () => {
    const cold = { ...STATED, mock: null };
    const structure = toMockStructure({ noticeQuestions: 60, ownerId: null, structure: cold });
    const [full] = listMockOptions({ dayInTurn: null, goalAreas: ["Direito Civil"], structure });

    expect(full).toMatchObject({ kind: "full", questions: 60 });
  });

  it("sits a past edition's total when the notice gives no number", () => {
    const cold = {
      ...STATED,
      mock: null,
      pastQuestions: PAST,
      subjects: [subject("Direito Civil", null), subject("Direito Penal", null)],
    };

    const structure = toMockStructure({ noticeQuestions: null, ownerId: null, structure: cold });
    const [full] = listMockOptions({ dayInTurn: null, goalAreas: ["Direito Civil"], structure });

    expect(full).toMatchObject({ kind: "full", questions: 12 });
  });

  it("sits a class test as long as its material says, and a short test only when it says nothing", () => {
    const material = { ...STATED, mock: null, subjects: [subject("Biologia", null)] };

    const stated = toMockStructure({
      noticeQuestions: 20,
      ownerId: "learner",
      structure: material,
    });

    const unstated = toMockStructure({
      noticeQuestions: null,
      ownerId: "learner",
      structure: material,
    });

    expect(stated.mock).toMatchObject({ totalQuestions: 20 });
    expect(unstated.mock).toMatchObject({ timeLimitMinutes: 30, totalQuestions: 10 });

    expect(
      getMockSizeSource({ noticeQuestions: 20, ownerId: "learner", structure: material }),
    ).toMatchObject({ material: true, questions: "notice", time: "unstated" });
  });
});
