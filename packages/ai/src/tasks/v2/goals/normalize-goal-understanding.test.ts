import { describe, expect, it } from "vitest";
import {
  type RawGoalUnderstanding,
  normalizeGoalUnderstanding,
} from "./normalize-goal-understanding";

type RawUnderstoodGoal = RawGoalUnderstanding["goals"][number];

const TODAY = "2026-09-26";

function rawGoal(overrides: Partial<RawUnderstoodGoal> = {}): RawUnderstoodGoal {
  return {
    examMonth: null,
    examName: null,
    examTarget: null,
    examYear: null,
    institution: null,
    kind: "learn",
    level: null,
    nativeLanguage: null,
    ownLevel: null,
    purpose: null,
    reason: null,
    role: null,
    subject: "Quantum physics",
    targetCourse: null,
    targetDate: null,
    targetLanguage: null,
    targetPosition: null,
    targetScore: null,
    title: "Understand quantum physics",
    ...overrides,
  };
}

function raw(overrides: Partial<RawGoalUnderstanding> = {}): RawGoalUnderstanding {
  return {
    dailyMinutes: null,
    followUps: [],
    goals: [rawGoal()],
    instrument: null,
    question: null,
    route: "goals",
    studyDays: null,
    studyTime: null,
    studyTimeNote: null,
    ...overrides,
  };
}

describe(normalizeGoalUnderstanding, () => {
  it("keeps what an exam goal said and leaves the rest undefined", () => {
    const result = normalizeGoalUnderstanding({
      raw: raw({
        goals: [
          rawGoal({
            examName: "ENEM",
            examYear: 2026,
            kind: "exam",
            purpose: "deep",
            subject: "ENEM",
            targetCourse: "Nursing",
            title: "Pass the 2026 ENEM",
          }),
        ],
        studyTime: "21:30",
        studyTimeNote: "At night, after school",
      }),
      today: TODAY,
    });

    expect(result).toStrictEqual({
      dailyMinutes: undefined,
      followUps: [],
      goals: [
        expect.objectContaining({
          examName: "ENEM",
          examYear: 2026,
          kind: "exam",
          purpose: undefined,
          targetCourse: "Nursing",
          targetDate: undefined,
          title: "Pass the 2026 ENEM",
        }),
      ],
      route: "goals",
      studyDays: undefined,
      studyTime: "21:30",
      studyTimeNote: "At night, after school",
    });
  });

  it("keeps the month the learner named for an exam, only a real one, and only for exams", () => {
    const result = normalizeGoalUnderstanding({
      raw: raw({
        goals: [
          rawGoal({ examMonth: 3, examName: "OAB", examYear: 2027, kind: "exam" }),
          rawGoal({ examMonth: 13, examName: "ENEM", kind: "exam" }),
          rawGoal({ examMonth: 3 }),
        ],
      }),
      today: TODAY,
    });

    expect(
      result.route === "goals" ? result.goals.map((goal) => goal.examMonth) : null,
    ).toStrictEqual([3, undefined, undefined]);
  });

  it("keeps what an exam's learner aims for beyond passing, only for exams", () => {
    const result = normalizeGoalUnderstanding({
      raw: raw({
        goals: [
          rawGoal({ examName: "ENEM", examTarget: "admission", kind: "exam" }),
          rawGoal({ examName: "OAB", examTarget: null, kind: "exam" }),
          rawGoal({ examTarget: "score" }),
        ],
      }),
      today: TODAY,
    });

    expect(
      result.route === "goals" ? result.goals.map((goal) => goal.examTarget) : null,
    ).toStrictEqual(["admission", undefined, undefined]);
  });

  it("drops past or invalid dates, invalid times and out-of-range weekdays", () => {
    const result = normalizeGoalUnderstanding({
      raw: raw({
        goals: [rawGoal({ targetDate: "2026-01-10" }), rawGoal({ targetDate: "2027-13-45" })],
        studyDays: [1, 3, 3, 9, -1],
        studyTime: "25:00",
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({ route: "goals", studyDays: [1, 3], studyTime: undefined });

    expect(result.route === "goals" && result.goals.map((goal) => goal.targetDate)).toStrictEqual([
      undefined,
      undefined,
    ]);
  });

  it("keeps daily minutes within what the planner accepts", () => {
    const tooLittle = normalizeGoalUnderstanding({ raw: raw({ dailyMinutes: 1 }), today: TODAY });
    const tooMuch = normalizeGoalUnderstanding({ raw: raw({ dailyMinutes: 600 }), today: TODAY });

    expect(tooLittle).toMatchObject({ dailyMinutes: 5 });
    expect(tooMuch).toMatchObject({ dailyMinutes: 240 });
  });

  it("drops language goals without a language and keeps at most three goals", () => {
    const result = normalizeGoalUnderstanding({
      raw: raw({
        goals: [
          rawGoal({ kind: "language", targetLanguage: null, title: "Speak better" }),
          rawGoal({
            kind: "language",
            nativeLanguage: "es",
            targetLanguage: "en",
            title: "English",
          }),
          rawGoal({ title: "Two" }),
          rawGoal({ title: "Three" }),
          rawGoal({ title: "Four" }),
        ],
      }),
      today: TODAY,
    });

    expect(result.route === "goals" && result.goals.map((goal) => goal.title)).toStrictEqual([
      "English",
      "Two",
    ]);
  });

  it("asks for more when nothing usable is left", () => {
    expect(
      normalizeGoalUnderstanding({ raw: raw({ goals: [rawGoal({ title: "  " })] }), today: TODAY }),
    ).toStrictEqual({ route: "unclear" });

    expect(
      normalizeGoalUnderstanding({ raw: raw({ question: null, route: "explain" }), today: TODAY }),
    ).toStrictEqual({ route: "unclear" });
  });

  it("returns only what each other route needs", () => {
    expect(
      normalizeGoalUnderstanding({
        raw: raw({ question: "How a microwave works", route: "explain" }),
        today: TODAY,
      }),
    ).toStrictEqual({ question: "How a microwave works", route: "explain" });

    expect(
      normalizeGoalUnderstanding({
        raw: raw({ instrument: "guitar", route: "instrument" }),
        today: TODAY,
      }),
    ).toStrictEqual({ instrument: "guitar", route: "instrument" });

    expect(
      normalizeGoalUnderstanding({ raw: raw({ route: "unsafe" }), today: TODAY }),
    ).toStrictEqual({ route: "unsafe" });
  });
});
