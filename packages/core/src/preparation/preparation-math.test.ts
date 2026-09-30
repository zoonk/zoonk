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

    expect(components.coverage).toStrictEqual({ studiedSkills: 2, totalSkills: 4, value: 0.5 });
    expect(components.retention.value).toBeCloseTo(0.8);
    expect(components.mastery).toStrictEqual({ answered: 5, correct: 4, value: 0.8 });
    expect(components.mocks).toStrictEqual({ kind: "mockExams", taken: 0, value: null });
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
      coverage: { studiedSkills: 2, totalSkills: 4, value: 0.5 },
      mastery: { answered: 10, correct: 8, value: 0.8 },
      mocks: { kind: "mockExams", taken: 0, value: null },
      retention: { studiedSkills: 2, value: 0.9 },
    });

    expect(value).toBeCloseTo(0.5 * ((0.8 * 0.4 + 0.9 * 0.3) / 0.7));
  });

  it("stays small after a little study, however well it is remembered", () => {
    const value = getPreparationValue({
      coverage: { studiedSkills: 1, totalSkills: 20, value: 0.05 },
      mastery: { answered: 0, correct: 0, value: null },
      mocks: { kind: "mockExams", taken: 0, value: null },
      retention: { studiedSkills: 1, value: 1 },
    });

    expect(value).toBeCloseTo(0.05);
  });

  it("is zero with nothing studied", () => {
    const value = getPreparationValue({
      coverage: { studiedSkills: 0, totalSkills: 20, value: 0 },
      mastery: { answered: 0, correct: 0, value: null },
      mocks: { kind: "mockExams", taken: 0, value: null },
      retention: { studiedSkills: 0, value: null },
    });

    expect(value).toBe(0);
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
