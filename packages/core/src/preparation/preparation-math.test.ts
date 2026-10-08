import { describe, expect, it } from "vitest";
import {
  type PreparationSkill,
  getPreparationComponents,
  getPreparationStage,
  getPreparationValue,
} from "./preparation-math";

const NOW = new Date("2026-09-20T12:00:00Z");
const WEEK_AGO = new Date("2026-09-13T12:00:00Z");

function skill(overrides: Partial<PreparationSkill> & { skillId: string }): PreparationSkill {
  return {
    areaId: "math",
    fading: false,
    retrievability: null,
    state: "new",
    studiedAt: null,
    ...overrides,
  };
}

const SKILLS = [
  skill({ retrievability: 0.9, skillId: "a", state: "solid", studiedAt: new Date("2026-09-01") }),
  skill({
    retrievability: 0.7,
    skillId: "b",
    state: "learning",
    studiedAt: new Date("2026-09-18"),
  }),
  skill({ skillId: "c" }),
  skill({ skillId: "d" }),
];

const ANSWERS = [
  { answeredAt: new Date("2026-09-02"), isCorrect: true, skillId: "a" },
  { answeredAt: new Date("2026-09-03"), isCorrect: true, skillId: "a" },
  { answeredAt: new Date("2026-09-04"), isCorrect: false, skillId: "a" },
  { answeredAt: new Date("2026-09-18"), isCorrect: true, skillId: "b" },
  { answeredAt: new Date("2026-09-19"), isCorrect: true, skillId: "b" },
];

describe(getPreparationComponents, () => {
  it("measures coverage and retention over studied skills", () => {
    const components = getPreparationComponents({
      answers: ANSWERS,
      asOf: NOW,
      mocks: [],
      skills: SKILLS,
    });

    // Every skill counts alike: the heavier half is the whole goal.
    expect(components.coverage).toStrictEqual({
      heaviest: { studiedSkills: 2, totalSkills: 4, value: 0.5 },
      studiedSkills: 2,
      totalSkills: 4,
      value: 0.5,
    });

    expect(components.retention.value).toBeCloseTo(0.8);
    expect(components.mastery).toStrictEqual({ answered: 5, correct: 4, evidence: 5, value: 0.8 });

    expect(components.mocks).toStrictEqual({
      kind: "mockExams",
      plusRequired: false,
      taken: 0,
      value: null,
    });
  });

  it("leaves mastery empty until enough questions were seen for the first time", () => {
    const components = getPreparationComponents({
      answers: ANSWERS.slice(0, 4),
      asOf: NOW,
      mocks: [],
      skills: SKILLS,
    });

    expect(components.mastery.value).toBeNull();
  });

  it("measures a past moment with only what happened by then", () => {
    const components = getPreparationComponents({
      answers: ANSWERS,
      asOf: WEEK_AGO,
      mocks: [],
      skills: SKILLS,
    });

    expect(components.coverage.studiedSkills).toBe(1);
    expect(components.mastery.answered).toBe(3);
  });

  it("averages the three latest mocks", () => {
    const mocks = [
      { correct: 30, endedAt: new Date("2026-09-06"), total: 45 },
      { correct: 18, endedAt: new Date("2026-08-30"), total: 45 },
      { correct: 27, endedAt: new Date("2026-09-13"), total: 45 },
      { correct: 36, endedAt: new Date("2026-09-19"), total: 45 },
    ];

    const components = getPreparationComponents({ answers: [], asOf: NOW, mocks, skills: SKILLS });

    expect(components.mocks.taken).toBe(3);
    expect(components.mocks.value).toBeCloseTo((30 + 27 + 36) / 135);
  });
});

describe(getPreparationValue, () => {
  it("is coverage times how well the studied part is known", () => {
    const value = getPreparationValue({
      coverage: {
        heaviest: { studiedSkills: 2, totalSkills: 4, value: 0.5 },
        studiedSkills: 2,
        totalSkills: 4,
        value: 0.5,
      },
      mastery: { answered: 10, correct: 8, evidence: 10, value: 0.8 },
      mocks: { kind: "mockExams", plusRequired: false, taken: 0, value: null },
      retention: { studiedSkills: 2, value: 0.9 },
    });

    // Eight right of ten supports about 54% (Wilson's lower bound), not 80%.
    expect(value).toBeCloseTo(0.5 * ((0.5408 * 0.4 + 0.9 * 0.3) / 0.7), 3);
  });

  it("stays small after a little study, however well it is remembered", () => {
    const value = getPreparationValue({
      coverage: {
        heaviest: { studiedSkills: 1, totalSkills: 20, value: 0.05 },
        studiedSkills: 1,
        totalSkills: 20,
        value: 0.05,
      },
      mastery: { answered: 0, correct: 0, evidence: 0, value: null },
      mocks: { kind: "mockExams", plusRequired: false, taken: 0, value: null },
      retention: { studiedSkills: 1, value: 1 },
    });

    expect(value).toBeCloseTo(0.05);
  });

  it("never reads a handful of right answers as fully prepared", () => {
    const fewAnswers = getPreparationValue({
      coverage: {
        heaviest: { studiedSkills: 3, totalSkills: 3, value: 1 },
        studiedSkills: 3,
        totalSkills: 3,
        value: 1,
      },
      mastery: { answered: 5, correct: 5, evidence: 5, value: 1 },
      mocks: { kind: "mockExams", plusRequired: false, taken: 1, value: 0.8 },
      retention: { studiedSkills: 3, value: 1 },
    });

    const manyAnswers = getPreparationValue({
      coverage: {
        heaviest: { studiedSkills: 3, totalSkills: 3, value: 1 },
        studiedSkills: 3,
        totalSkills: 3,
        value: 1,
      },
      mastery: { answered: 40, correct: 40, evidence: 40, value: 1 },
      mocks: { kind: "mockExams", plusRequired: false, taken: 1, value: 0.8 },
      retention: { studiedSkills: 3, value: 1 },
    });

    expect(fewAnswers).toBeLessThan(0.85);
    expect(manyAnswers).toBeGreaterThan(fewAnswers);
    expect(manyAnswers).toBeLessThan(1);
  });

  it("is zero with nothing studied", () => {
    const value = getPreparationValue({
      coverage: {
        heaviest: { studiedSkills: 0, totalSkills: 20, value: 0 },
        studiedSkills: 0,
        totalSkills: 20,
        value: 0,
      },
      mastery: { answered: 0, correct: 0, evidence: 0, value: null },
      mocks: { kind: "mockExams", plusRequired: false, taken: 0, value: null },
      retention: { studiedSkills: 0, value: null },
    });

    expect(value).toBe(0);
  });
});

describe("preparation weighted by what the exam asks and how hard it is", () => {
  const studied = new Date("2026-09-01");

  /** Two easy topics the exam rarely asks and one hard topic it asks a lot. */
  const weighted = [
    skill({ importance: 0.5, retrievability: 0.9, skillId: "easy-1", studiedAt: studied }),
    skill({ importance: 0.5, retrievability: 0.9, skillId: "easy-2", studiedAt: studied }),
    skill({ importance: 3, skillId: "hard" }),
  ];

  const rightOnEasy = Array.from({ length: 40 }, (_, index) => ({
    answeredAt: new Date(`2026-09-${String(2 + (index % 20)).padStart(2, "0")}`),
    isCorrect: true,
    skillId: index % 2 === 0 ? "easy-1" : "easy-2",
  }));

  it("counts a hard, often asked topic more than easy ones, untested ones as not ready", () => {
    const components = getPreparationComponents({
      answers: rightOnEasy,
      asOf: NOW,
      mocks: [],
      skills: weighted,
    });

    // Two of three skills studied, but only a quarter of what the goal asks.
    expect(components.coverage.studiedSkills).toBe(2);
    expect(components.coverage.value).toBeCloseTo(0.25);
    expect(components.coverage.heaviest.value).toBe(0);
  });

  it("never reads as solid without evidence on the hard part and a mock, however well the rest went", () => {
    // Seventeen medium topics studied and known well, three hard ones never tested.
    const goal = [
      ...Array.from({ length: 17 }, (_, index) =>
        skill({ retrievability: 0.95, skillId: `medium-${index}`, studiedAt: studied }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        skill({ importance: 1.5, skillId: `hard-${index}` }),
      ),
    ];

    const rightOnMedium = Array.from({ length: 40 }, (_, index) => ({
      answeredAt: studied,
      isCorrect: true,
      skillId: `medium-${index % 17}`,
    }));

    const mockExams = [{ correct: 44, endedAt: studied, total: 45 }];

    const easyPart = getPreparationValue(
      getPreparationComponents({
        answers: rightOnMedium,
        asOf: NOW,
        mocks: mockExams,
        skills: goal,
      }),
    );

    expect(getPreparationStage(easyPart)).toBe("growing");

    const withHard = getPreparationValue(
      getPreparationComponents({
        answers: rightOnMedium,
        asOf: NOW,
        mocks: mockExams,
        skills: goal.map((item) => ({ ...item, retrievability: 0.95, studiedAt: studied })),
      }),
    );

    expect(getPreparationStage(withHard)).toBe("solid");

    // The same evidence without a mock exam stays below Solid: no test in real conditions yet.
    const withoutMock = getPreparationValue(
      getPreparationComponents({
        answers: rightOnMedium,
        asOf: NOW,
        mocks: [],
        skills: goal.map((item) => ({ ...item, retrievability: 0.95, studiedAt: studied })),
      }),
    );

    expect(getPreparationStage(withoutMock)).toBe("growing");
  });

  it("weighs answers on hard topics more than answers on easy ones", () => {
    const skills = weighted.map((item) => ({ ...item, studiedAt: studied }));

    const answers = [
      ...Array.from({ length: 6 }, () => ({
        answeredAt: studied,
        isCorrect: true,
        skillId: "easy-1",
      })),
      ...Array.from({ length: 4 }, () => ({
        answeredAt: studied,
        isCorrect: false,
        skillId: "hard",
      })),
    ];

    const { mastery } = getPreparationComponents({ answers, asOf: NOW, mocks: [], skills });

    // Six of ten right, but the four wrong ones are on the topic worth six times as much.
    expect(mastery.correct).toBe(6);
    expect(mastery.value).toBeCloseTo(3 / 15);
    expect(mastery.evidence).toBeLessThan(10);
  });
});

describe(getPreparationStage, () => {
  it("ends at Solid, never at a promise", () => {
    expect(getPreparationStage(0.1)).toBe("starting");
    expect(getPreparationStage(0.3)).toBe("building");
    expect(getPreparationStage(0.6)).toBe("growing");
    expect(getPreparationStage(0.9)).toBe("solid");
  });
});
