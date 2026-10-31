import { describe, expect, it } from "vitest";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import {
  COMMON_TEST_STRUCTURE,
  ENGLISH_JA,
  GERMAN_JA,
  KOKUGO,
  MATH_II_B_C,
  MATH_I_A,
} from "./_test-utils/choice-blueprint";
import { scopeExamStructure } from "./exam-scope";

const structure = examStructureSchema.parse(COMMON_TEST_STRUCTURE);

function scope(examSubjects: string[], from: ExamStructure = structure) {
  return scopeExamStructure({ examSubjects, structure: from });
}

function paper(name: string) {
  return { day: 1, kind: "objective" as const, minutes: 90, name, questions: 60 };
}

function science(name: string) {
  return { ...structure.subjects[0], group: null, name, questions: 60 };
}

function names(scoped: ExamStructure) {
  return scoped.subjects.map((subject) => subject.name);
}

describe(scopeExamStructure, () => {
  it("keeps only the subject the learner prepares, with the mock sections that ask it", () => {
    const english = scope(["英語"]);

    expect(names(english)).toStrictEqual([ENGLISH_JA]);

    expect(english.mock).toMatchObject({
      sections: [{ name: "英語（リーディング）" }, { name: "英語（リスニング）" }],
      timeLimitMinutes: 140,
      totalQuestions: 87,
    });
  });

  it("finds each subject a word starts, but never one it sits inside", () => {
    expect(names(scope(["英語", "数学"]))).toStrictEqual([MATH_I_A, MATH_II_B_C, ENGLISH_JA]);
    expect(names(scope(["国語"]))).toStrictEqual([KOKUGO]);
  });

  it("prefers the subject named exactly over the longer ones it starts", () => {
    const physics = examStructureSchema.parse({
      ...COMMON_TEST_STRUCTURE,
      subjects: [
        { ...structure.subjects[0], name: "物理基礎" },
        { ...structure.subjects[0], name: "物理" },
      ],
    });

    expect(names(scope(["物理"], physics))).toStrictEqual(["物理"]);
  });

  it("counts right answers in a mock of part of the exam, which has no share of its points", () => {
    const citation = { passage: "配点", sourceId: "notice" };

    const part = (name: string, maxPoints: number) => ({
      citation,
      maxPoints,
      minimum: null,
      name,
      qualifying: false,
      questions: null,
    });

    const scored = examStructureSchema.parse({
      ...COMMON_TEST_STRUCTURE,
      mock: {
        ...COMMON_TEST_STRUCTURE.mock,
        scoring: {
          description: "",
          finalShares: [{ citation, parts: [KOKUGO, "英語（リーディング）"], share: 1 }],
          marking: [
            {
              citation,
              format: null,
              part: KOKUGO,
              points: 2,
              questions: null,
              select: null,
              wrongPoints: null,
            },
            {
              citation,
              format: null,
              part: null,
              points: 1,
              questions: 262,
              select: null,
              wrongPoints: null,
            },
          ],
          method: "raw",
          parts: [
            part(KOKUGO, 200),
            part("英語（リーディング）", 100),
            part("英語（リスニング）", 100),
          ],
          totalMinimum: { citation, unit: "points", value: 300 },
        },
      },
    });

    expect(scope(["英語"], scored).mock?.scoring).toStrictEqual({
      description: "",
      method: "raw",
      totalMinimum: null,
    });
  });

  it("reads a learner's ASCII numerals as the notice's, never as a higher numbered subject", () => {
    expect(names(scope(["数学I"]))).toStrictEqual([MATH_I_A]);
    expect(names(scope(["数学II"]))).toStrictEqual([MATH_II_B_C]);

    const numbered = examStructureSchema.parse({
      ...COMMON_TEST_STRUCTURE,
      mock: null,
      subjects: [
        { ...structure.subjects[0], name: "Mathematics II" },
        { ...structure.subjects[0], name: "Mathematics III" },
      ],
    });

    expect(names(scope(["math II"], numbered))).toStrictEqual(["Mathematics II"]);
  });

  it("never takes a subject whose name only looks like the learner's word", () => {
    const sciences = examStructureSchema.parse({
      ...COMMON_TEST_STRUCTURE,
      mock: null,
      subjects: [
        { ...structure.subjects[0], name: "Physics HL" },
        { ...structure.subjects[0], name: "Physical Education" },
      ],
    });

    expect(names(scope(["physics"], sciences))).toStrictEqual(["Physics HL"]);
  });

  it("keeps the kept subjects' share of a paper they sit with others", () => {
    const shared = examStructureSchema.parse({
      ...COMMON_TEST_STRUCTURE,
      mock: {
        ...COMMON_TEST_STRUCTURE.mock,
        sections: [
          { day: 1, kind: "objective", minutes: 300, name: "Provas objetivas", questions: 90 },
        ],
      },
      subjects: [
        { ...structure.subjects[0], group: "Provas objetivas", name: "Matemática", questions: 45 },
        { ...structure.subjects[0], group: "Provas objetivas", name: "Linguagens", questions: 45 },
      ],
    });

    expect(scope(["Matemática"], shared).mock).toMatchObject({
      sections: [{ minutes: 150, name: "Provas objetivas", questions: 45 }],
      timeLimitMinutes: 150,
      totalQuestions: 45,
    });
  });

  it("counts a subject once across the papers it shares, and cuts an exam without papers", () => {
    const shared = examStructureSchema.parse({
      ...COMMON_TEST_STRUCTURE,
      mock: {
        ...COMMON_TEST_STRUCTURE.mock,
        sections: [paper("Biology & Chemistry Paper 1"), paper("Biology & Chemistry Paper 2")],
      },
      subjects: [science("Biology"), science("Chemistry")],
    });

    expect(scope(["Biology"], shared).mock).toMatchObject({
      timeLimitMinutes: 90,
      totalQuestions: 60,
    });

    const unsplit = examStructureSchema.parse({
      ...shared,
      mock: { ...shared.mock, sections: [], timeLimitMinutes: 180, totalQuestions: 120 },
    });

    expect(scope(["Biology"], unsplit).mock).toMatchObject({
      timeLimitMinutes: 90,
      totalQuestions: 60,
    });
  });

  it("keeps the whole exam when the learner names no subject of it", () => {
    expect(scope([])).toBe(structure);
    expect(scope(["地学"])).toBe(structure);
  });

  it("keeps the options of a choice the learner names as a whole", () => {
    expect(names(scope(["外国語"]))).toStrictEqual([ENGLISH_JA, GERMAN_JA]);
  });
});
