import { describe, expect, it } from "vitest";
import {
  checkCoverageShown,
  checkReadinessHonest,
  checkScoreEstimateEarned,
} from "./readiness-rules";
import { type RuleAnswer, type RulePreparation } from "./rule-context";
import { ruleContext, ruleDay, rulePlan, ruleSkill } from "./rule-fixtures";

const after = rulePlan({ skills: [] });

function preparation(overrides: Partial<RulePreparation> = {}): RulePreparation {
  return {
    components: { coverage: { studiedSkills: 1, value: 0.4 }, mocks: { taken: 1 } },
    estimatedScore: null,
    mocks: [],
    value: 0.3,
    ...overrides,
  };
}

function answer(skillId: string, source: RuleAnswer["source"], correct = true): RuleAnswer {
  return { at: ruleDay(0), correct, format: "other", skillId, source };
}

function mock(day: number, questions: number, subjectOnly = false) {
  return { endedAt: ruleDay(day), questions, subjectOnly };
}

describe("R34 readiness counts only what the learner showed", () => {
  it("passes when every counted skill was studied in a lesson or answered right in practice", () => {
    const answers = [answer("a", "lesson", false), answer("b", "practice")];

    const prep = preparation({
      components: { coverage: { studiedSkills: 2, value: 0.5 }, mocks: { taken: 0 } },
    });

    expect(checkCoverageShown(ruleContext({ after, answers, preparation: prep }))).toStrictEqual(
      [],
    );
  });

  it("counts the plan skill a finished lesson counts for as shown, without answers on it", () => {
    const answers = [answer("b", "practice")];

    const finishedLessons = [
      { comesBackOn: null, day: ruleDay(0), lessonId: "a-0", skillIds: ["a", "run-a-test"] },
    ];

    const prep = preparation({
      components: { coverage: { studiedSkills: 2, value: 0.5 }, mocks: { taken: 0 } },
    });

    const context = ruleContext({
      after: rulePlan({ skills: [ruleSkill({ skillId: "a" }), ruleSkill({ skillId: "b" })] }),
      answers,
      finishedLessons,
      preparation: prep,
    });

    expect(checkCoverageShown(context)).toStrictEqual([]);
  });

  it("flags a skill counted from a placement answer alone", () => {
    const answers = [answer("a", "lesson"), answer("b", "placement")];

    const prep = preparation({
      components: { coverage: { studiedSkills: 2, value: 0.5 }, mocks: { taken: 0 } },
    });

    expect(checkCoverageShown(ruleContext({ after, answers, preparation: prep }))).toMatchObject([
      { details: { counted: 2, shown: 1 }, rule: "R34" },
    ]);
  });
});

describe("R35 readiness never says more than the evidence", () => {
  it("passes when it stays under coverage and Solid comes after a mock", () => {
    const prep = preparation({
      components: { coverage: { studiedSkills: 9, value: 0.9 }, mocks: { taken: 1 } },
      value: 0.8,
    });

    expect(checkReadinessHonest(ruleContext({ after, preparation: prep }))).toStrictEqual([]);
  });

  it("flags Solid without a test, and readiness above what was studied", () => {
    const prep = preparation({
      components: { coverage: { studiedSkills: 9, value: 0.7 }, mocks: { taken: 0 } },
      value: 0.8,
    });

    expect(checkReadinessHonest(ruleContext({ after, preparation: prep }))).toMatchObject([
      { details: { coverage: 0.7 }, rule: "R35" },
      { details: { mocksTaken: 0 }, rule: "R35" },
    ]);
  });
});

describe("R36 an estimated score needs enough mocks", () => {
  it("passes for a range from three mocks with 45 questions", () => {
    const prep = preparation({
      estimatedScore: { high: 72, low: 58 },
      mocks: [mock(1, 15), mock(8, 15), mock(15, 15, true)],
    });

    expect(checkScoreEstimateEarned(ruleContext({ after, preparation: prep }))).toStrictEqual([]);
  });

  it("flags an estimate from one eight-question subject mock (Sofia's 68 to 100%)", () => {
    const prep = preparation({ estimatedScore: { high: 100, low: 68 }, mocks: [mock(1, 8, true)] });

    expect(checkScoreEstimateEarned(ruleContext({ after, preparation: prep }))).toMatchObject([
      { details: { questions: 8 }, rule: "R36" },
      { details: { subjectOnly: true }, rule: "R36" },
    ]);
  });
});
