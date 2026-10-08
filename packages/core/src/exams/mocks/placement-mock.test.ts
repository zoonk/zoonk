import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockCandidate, countPlannedQuestions } from "./mock-plan";
import {
  type PlacementSkill,
  getRecommendedPlacementLength,
  listPlacementMockOptions,
  planPlacementMock,
} from "./placement-mock";

const CITATION = { passage: "From the notice.", sourceId: "source" };

function subject(name: string, questions: number | null, shortName: string | null = null) {
  return { citation: CITATION, name, questions, shortName, topics: [], weight: null };
}

/** ENEM's shape: two days of 90 questions, the first with the redação as a written part. */
const ENEM: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "itemResponseTheory" },
    sections: [
      { day: 1, minutes: 330, name: "Linguagens, Ciências Humanas e redação", questions: 90 },
      { day: 1, kind: "written", minutes: null, name: "Redação", questions: null },
      { day: 2, minutes: 300, name: "Ciências da Natureza e Matemática", questions: 90 },
    ],
    timeLimitMinutes: null,
    totalQuestions: 180,
  },
  rules: [],
  subjects: [
    subject("Linguagens, Códigos e suas Tecnologias", null, "Linguagens"),
    subject("Ciências Humanas e suas Tecnologias", null, "Ciências Humanas"),
    subject("Ciências da Natureza e suas Tecnologias", null, "Ciências da Natureza"),
    subject("Matemática e suas Tecnologias", null, "Matemática"),
    subject("Redação", null),
  ],
};

const ENEM_AREAS = [
  "Linguagens, Códigos e suas Tecnologias",
  "Ciências Humanas e suas Tecnologias",
  "Ciências da Natureza e suas Tecnologias",
  "Matemática e suas Tecnologias",
  "Redação",
];

/** The OAB's shape: one test of 80 questions in five hours over many subjects of unequal size. */
const SUBJECT_SIZES = [8, 7, 6, 6, 6, 6, 6, 6, 5, 5, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1];
const SUBJECTS = SUBJECT_SIZES.map((questions, index) => subject(`Direito ${index}`, questions));

const OAB: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [{ day: null, minutes: 300, name: "Prova objetiva", questions: 80 }],
    timeLimitMinutes: 300,
    totalQuestions: 80,
  },
  rules: [],
  subjects: SUBJECTS,
};

/** A class test of ten questions in half an hour. */
const CLASS_TEST: ExamStructure = {
  ...OAB,
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [{ day: null, minutes: 30, name: "Prova", questions: 10 }],
    timeLimitMinutes: 30,
    totalQuestions: 10,
  },
  subjects: [subject("Biologia", 10)],
};

function sizes(options: ReturnType<typeof listPlacementMockOptions>) {
  return options.map(({ coversAllAreas, estimatedMinutes, length, minutes, questions }) => ({
    coversAllAreas,
    estimatedMinutes,
    length,
    minutes,
    questions,
  }));
}

describe(listPlacementMockOptions, () => {
  it("comes in a quick check, half an hour and an hour at the exam's pace, every area in each", () => {
    const options = listPlacementMockOptions({
      goalAreas: ENEM_AREAS,
      pace: null,
      structure: ENEM,
    });

    expect(sizes(options)).toStrictEqual([
      { coversAllAreas: true, estimatedMinutes: 18, length: "short", minutes: 18, questions: 5 },
      { coversAllAreas: true, estimatedMinutes: 31, length: "medium", minutes: 31, questions: 9 },
      { coversAllAreas: true, estimatedMinutes: 60, length: "long", minutes: 60, questions: 17 },
    ]);

    // The written test has no questions to ask.
    expect(options[0]?.areas).toStrictEqual([
      "Linguagens",
      "Ciências Humanas",
      "Ciências da Natureza",
      "Matemática",
    ]);

    expect(getRecommendedPlacementLength(options)).toBe("short");
  });

  it("asks as many as learners really answer in that time, and says how long they take", () => {
    const options = listPlacementMockOptions({ goalAreas: ENEM_AREAS, pace: 2, structure: ENEM });

    expect(sizes(options)).toStrictEqual([
      { coversAllAreas: true, estimatedMinutes: 16, length: "short", minutes: 28, questions: 8 },
      { coversAllAreas: true, estimatedMinutes: 30, length: "medium", minutes: 52, questions: 15 },
      { coversAllAreas: true, estimatedMinutes: 60, length: "long", minutes: 106, questions: 30 },
    ]);
  });

  it("asks every subject once in half an hour and twice in an hour, however many there are", () => {
    const options = listPlacementMockOptions({
      goalAreas: SUBJECTS.map((item) => item.name),
      pace: null,
      structure: OAB,
    });

    expect(sizes(options)).toStrictEqual([
      { coversAllAreas: false, estimatedMinutes: 19, length: "short", minutes: 19, questions: 5 },
      { coversAllAreas: true, estimatedMinutes: 75, length: "medium", minutes: 75, questions: 20 },
      { coversAllAreas: true, estimatedMinutes: 150, length: "long", minutes: 150, questions: 40 },
    ]);

    // A quick check asks the subjects worth most and leaves the rest to the first days.
    expect(options[0]?.areas).toStrictEqual([
      "Direito 0",
      "Direito 1",
      "Direito 2",
      "Direito 3",
      "Direito 4",
    ]);

    expect(options[2]?.counts.map((entry) => entry.questions)).toStrictEqual(SUBJECTS.map(() => 2));
  });

  it("never asks more than the whole exam: lengths that would ask as many are one", () => {
    const options = listPlacementMockOptions({
      goalAreas: ["Biologia"],
      pace: null,
      structure: CLASS_TEST,
    });

    expect(sizes(options)).toStrictEqual([
      { coversAllAreas: true, estimatedMinutes: 15, length: "short", minutes: 15, questions: 5 },
      { coversAllAreas: true, estimatedMinutes: 30, length: "long", minutes: 30, questions: 10 },
    ]);

    expect(getRecommendedPlacementLength(options)).toBe("short");
  });

  it("asks the notice's subjects while the plan is still being drawn", () => {
    const [short] = listPlacementMockOptions({ goalAreas: [], pace: null, structure: ENEM });

    expect(short?.areas).toHaveLength(4);
  });
});

/** Four topics per ENEM area in the plan's order, each with two questions in the bank. */
const SKILLS: PlacementSkill[] = ENEM_AREAS.slice(0, 4).flatMap((area) =>
  Array.from({ length: 4 }, (_, index) => ({ area, skillId: `${area}#${index}` })),
);

const BANK: MockCandidate[] = SKILLS.flatMap((skill) =>
  Array.from({ length: 2 }, (_, copy) => ({
    area: skill.area,
    difficulty: null,
    itemId: `${skill.skillId}/${copy}`,
    skillId: skill.skillId,
  })),
);

describe(planPlacementMock, () => {
  const [, medium] = listPlacementMockOptions({
    goalAreas: ENEM_AREAS,
    pace: null,
    structure: ENEM,
  });

  it("spreads each area's questions over its topics and sits them as the exam does", () => {
    if (!medium) {
      throw new Error("Expected the half-hour length");
    }

    const { missingSkillIds, plan } = planPlacementMock({
      candidates: BANK,
      option: medium,
      skills: SKILLS,
      structure: ENEM,
    });

    const asked = plan.sections.flatMap((section) => section.itemIds);

    expect(countPlannedQuestions(plan)).toBe(9);
    expect(new Set(asked).size).toBe(asked.length);
    expect(missingSkillIds).toStrictEqual([]);

    // Day one's section asks its two areas, day two's the other two, at each day's pace.
    expect(
      plan.sections.map(({ minutes, name, questions }) => ({ minutes, name, questions })),
    ).toStrictEqual([
      { minutes: 18, name: "Linguagens, Ciências Humanas e redação", questions: 5 },
      { minutes: 13, name: "Ciências da Natureza e Matemática", questions: 4 },
    ]);

    // Two questions on an area of four topics: its basics and its second half, not two basics.
    const math = asked.filter((id) => id.startsWith("Matemática"));

    expect(math.map((id) => id.split("/")[0])).toStrictEqual([
      "Matemática e suas Tecnologias#0",
      "Matemática e suas Tecnologias#2",
    ]);
  });

  it("takes the nearest topic's question when a topic has none, and says which to write", () => {
    if (!medium) {
      throw new Error("Expected the half-hour length");
    }

    const bank = BANK.filter((item) => item.skillId !== "Matemática e suas Tecnologias#2");

    const { missingSkillIds, plan } = planPlacementMock({
      candidates: bank,
      option: medium,
      skills: SKILLS,
      structure: ENEM,
    });

    expect(countPlannedQuestions(plan)).toBe(9);
    expect(missingSkillIds).toStrictEqual(["Matemática e suas Tecnologias#2"]);
  });

  it("asks each subject on its own topics, never a subject named inside another's", () => {
    const structure: ExamStructure = {
      ...OAB,
      subjects: [subject("Direito Civil", 7), subject("Direito Processual Civil", 6)],
    };

    const skills: PlacementSkill[] = ["Direito Civil", "Direito Processual Civil"].flatMap((area) =>
      Array.from({ length: 3 }, (_, index) => ({ area, skillId: `${area}#${index}` })),
    );

    const bank: MockCandidate[] = skills.map((skill) => ({
      area: skill.area,
      difficulty: null,
      itemId: `${skill.skillId}/0`,
      skillId: skill.skillId,
    }));

    const [short] = listPlacementMockOptions({
      goalAreas: ["Direito Civil", "Direito Processual Civil"],
      pace: null,
      structure,
    });

    if (!short) {
      throw new Error("Expected the quick check");
    }

    const { plan } = planPlacementMock({ candidates: bank, option: short, skills, structure });
    const asked = plan.sections.flatMap((section) => section.itemIds).map((id) => id.split("#")[0]);

    expect(short.counts.map((entry) => entry.questions)).toStrictEqual([3, 2]);
    expect(asked.filter((area) => area === "Direito Civil")).toHaveLength(3);
    expect(asked.filter((area) => area === "Direito Processual Civil")).toHaveLength(2);
  });
});
