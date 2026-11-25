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

function listSizes({
  noticeQuestions = null,
  ownerId = null,
  structure,
}: {
  noticeQuestions?: number | null;
  ownerId?: string | null;
  structure: ExamStructure;
}) {
  const sized = toMockStructure({ noticeQuestions, ownerId, structure });

  return listMockOptions({
    goalAreas: structure.subjects.map((item) => item.name),
    structure: sized,
  }).map((option) => ({
    area: option.area,
    day: option.day,
    kind: option.kind,
    questions: option.questions,
  }));
}

function sitting(day: number, name: string) {
  return { day, kind: "objective" as const, minutes: 300, name, questions: 150 };
}

describe(getMockSizeSource, () => {
  it("says nothing more when the notice states the size, the time and each subject's share", () => {
    expect(
      getMockSizeSource({
        examName: "ENEM",
        noticeQuestions: null,
        ownerId: null,
        structure: STATED,
      }),
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

    expect(
      getMockSizeSource({ examName: "ENEM", noticeQuestions: null, ownerId: null, structure }),
    ).toMatchObject({
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

    expect(
      getMockSizeSource({ examName: "ENEM", noticeQuestions: null, ownerId: null, structure }),
    ).toMatchObject({ pastEdition: null, subjects: "even" });
  });

  it("takes the size from the notice's edition, and says when nothing states it or its time", () => {
    const cold = {
      ...STATED,
      mock: null,
      subjects: [subject("Direito Civil", null), subject("Direito Penal", null)],
    };

    expect(
      getMockSizeSource({ examName: "ENEM", noticeQuestions: 60, ownerId: null, structure: cold }),
    ).toMatchObject({ questions: "notice", time: "unstated" });

    expect(
      getMockSizeSource({
        examName: "ENEM",
        noticeQuestions: null,
        ownerId: null,
        structure: cold,
      }),
    ).toMatchObject({ questions: "unstated", time: "unstated" });
  });

  it("says a class test's length is the app's own when the learner's material doesn't give one", () => {
    const material = { ...STATED, mock: null, subjects: [subject("Biologia", null)] };

    expect(
      getMockSizeSource({
        examName: "ENEM",
        noticeQuestions: null,
        ownerId: "learner",
        structure: material,
      }),
    ).toMatchObject({ material: true, questions: "unstated", subjects: null });
  });
});

describe(toMockStructure, () => {
  it("sits as many questions as the notice's edition states, never a length of its own", () => {
    const cold = { ...STATED, mock: null };
    const structure = toMockStructure({ noticeQuestions: 60, ownerId: null, structure: cold });
    const [full] = listMockOptions({ goalAreas: ["Direito Civil"], structure });

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
    const [full] = listMockOptions({ goalAreas: ["Direito Civil"], structure });

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
      getMockSizeSource({
        examName: "ENEM",
        noticeQuestions: 20,
        ownerId: "learner",
        structure: material,
      }),
    ).toMatchObject({ material: true, questions: "notice", time: "unstated" });
  });

  it("keeps the largest real exams whole: 300 questions a sitting over two days", () => {
    const structure: ExamStructure = {
      ...STATED,
      mock: {
        ...MOCK,
        sections: [
          sitting(1, "Unit 1"),
          sitting(1, "Unit 2"),
          sitting(2, "Unit 3"),
          sitting(2, "Unit 4"),
        ],
        timeLimitMinutes: null,
        totalQuestions: 600,
      },
      subjects: [subject("Medicine", 300), subject("Surgery", 300)],
    };

    expect(listSizes({ structure })).toStrictEqual([
      { area: null, day: 1, kind: "full", questions: 300 },
      { area: null, day: 2, kind: "full", questions: 300 },
      { area: null, day: 1, kind: "half", questions: 150 },
      { area: null, day: 2, kind: "half", questions: 150 },
      { area: "Medicine", day: null, kind: "area", questions: 300 },
      { area: "Surgery", day: null, kind: "area", questions: 300 },
    ]);
  });

  it("sets aside counts no real exam has, and keeps the notice's other conditions", () => {
    const structure: ExamStructure = {
      ...STATED,
      mock: {
        ...MOCK,
        sections: MOCK.sections.map((section) => ({ ...section, questions: 50_000 })),
        totalQuestions: 50_000,
      },
      subjects: [subject("Direito Civil", 25_000), subject("Direito Penal", 25_000)],
    };

    const sized = toMockStructure({ noticeQuestions: 50_000, ownerId: null, structure });

    expect(sized.mock).toMatchObject({ timeLimitMinutes: 300, totalQuestions: null });

    expect(listSizes({ noticeQuestions: 50_000, structure })[0]).toMatchObject({
      kind: "full",
      questions: 45,
    });

    expect(
      getMockSizeSource({ examName: "ENEM", noticeQuestions: 50_000, ownerId: null, structure }),
    ).toMatchObject({ questions: "unstated", subjects: "even" });
  });

  it("never sits one subject longer than a real sitting, even when the day's count is real", () => {
    const structure: ExamStructure = {
      ...STATED,
      subjects: [subject("Direito Civil", 40), subject("Direito Penal", 40_000)],
    };

    expect(listSizes({ structure }).map((option) => option.questions)).toStrictEqual([
      45, 23, 20, 20,
    ]);
  });

  it("sizes the mock as for a notice that says nothing when its sittings describe more than any exam", () => {
    const structure: ExamStructure = {
      ...STATED,
      mock: {
        ...MOCK,
        sections: Array.from({ length: 40 }, (_, day) => ({
          day: day + 1,
          kind: "objective" as const,
          minutes: 60,
          name: `Day ${day + 1}`,
          questions: null,
        })),
        timeLimitMinutes: null,
        totalQuestions: null,
      },
      subjects: [subject("Direito Civil", null), subject("Direito Penal", null)],
    };

    expect(listSizes({ structure })).toStrictEqual([
      { area: null, day: null, kind: "full", questions: 45 },
      { area: null, day: null, kind: "half", questions: 23 },
      { area: "Direito Civil", day: null, kind: "area", questions: 20 },
      { area: "Direito Penal", day: null, kind: "area", questions: 20 },
    ]);

    expect(
      toMockStructure({ noticeQuestions: null, ownerId: "learner", structure }).mock,
    ).toMatchObject({ sections: [], totalQuestions: 10 });
  });
});
