import { describe, expect, it } from "vitest";
import {
  BRAIN_POWER_BONUS,
  EMPTY_OUTCOME,
  type ScoredAnswer,
  advanceHyperdrive,
  capExtraPractice,
  estimateBrainPower,
  getAnswersEnergyDelta,
  getHyperdriveLevel,
  getOutcomeBonus,
  scoreAnswers,
} from "./brain-power";

const right = (material: ScoredAnswer["material"] = "new", priorRightAnswers = 0) => ({
  isCorrect: true,
  material,
  priorRightAnswers,
});

const wrong = { isCorrect: false, material: "new", priorRightAnswers: 0 } as const;

const boss = (passed: boolean) => ({ kind: "boss" as const, passed });

describe(scoreAnswers, () => {
  it("multiplies each right answer by the Hyperdrive reached, up to x5", () => {
    const result = scoreAnswers({ answers: Array.from({ length: 7 }, () => right()) });

    // 2 points times x1, x2, x3, x4, x5, x5, x5
    expect(result).toStrictEqual({
      brainPower: 50,
      points: [2, 4, 6, 8, 10, 10, 10],
      streak: 7,
      topLevel: 5,
    });
  });

  it("resets Hyperdrive on a wrong answer without taking points away", () => {
    const result = scoreAnswers({ answers: [right(), right(), right(), wrong, right()] });

    expect(result).toStrictEqual({
      brainPower: 14,
      points: [2, 4, 6, 0, 2],
      streak: 1,
      topLevel: 3,
    });
  });

  it("continues the session's streak from an earlier block", () => {
    expect(scoreAnswers({ answers: [right("due")], streak: 4 })).toStrictEqual({
      brainPower: 10,
      points: [10],
      streak: 5,
      topLevel: 5,
    });
  });

  it("pays easy repeats less and less and never lets them build Hyperdrive", () => {
    const result = scoreAnswers({
      answers: [right("repeat", 1), right("repeat", 2), right("repeat", 5)],
      streak: 2,
    });

    expect(result).toStrictEqual({ brainPower: 1, points: [1, 0, 0], streak: 2, topLevel: 0 });
  });

  it("earns nothing and keeps nothing for wrong answers only", () => {
    expect(scoreAnswers({ answers: [wrong, wrong] })).toStrictEqual({
      brainPower: 0,
      points: [0, 0],
      streak: 0,
      topLevel: 0,
    });
  });
});

describe(advanceHyperdrive, () => {
  it("builds on new or due material, holds on repeats and resets on mistakes", () => {
    expect(advanceHyperdrive({ answer: right("due"), streak: 2 })).toBe(3);
    expect(advanceHyperdrive({ answer: right("repeat", 1), streak: 2 })).toBe(2);
    expect(advanceHyperdrive({ answer: wrong, streak: 4 })).toBe(0);
  });
});

describe(getHyperdriveLevel, () => {
  it("shows at least x1 and caps the multiplier", () => {
    expect(getHyperdriveLevel(0)).toBe(1);
    expect(getHyperdriveLevel(3)).toBe(3);
    expect(getHyperdriveLevel(11)).toBe(5);
  });
});

describe(getOutcomeBonus, () => {
  it("adds the bonuses for what a block achieved", () => {
    expect(
      getOutcomeBonus({
        ...EMPTY_OUTCOME,
        capsulesOpened: 3,
        firstLessonCompletion: true,
        skillsMastered: 1,
        skillsSolid: 2,
      }),
    ).toBe(10 + 15 + 25 + 20);
  });

  it("pays a boss only when won and a weekly challenge for finishing it", () => {
    expect(getOutcomeBonus({ ...EMPTY_OUTCOME, checkpoint: boss(true) })).toBe(
      BRAIN_POWER_BONUS.phaseBoss,
    );

    expect(getOutcomeBonus({ ...EMPTY_OUTCOME, checkpoint: boss(false) })).toBe(0);

    expect(
      getOutcomeBonus({ ...EMPTY_OUTCOME, checkpoint: { kind: "finalBoss", passed: true } }),
    ).toBe(BRAIN_POWER_BONUS.finalBoss);

    expect(
      getOutcomeBonus({ ...EMPTY_OUTCOME, checkpoint: { kind: "weekly", passed: false } }),
    ).toBe(BRAIN_POWER_BONUS.weeklyChallenge);
  });
});

describe(capExtraPractice, () => {
  it("stops extra practice from earning past the daily cap", () => {
    expect(capExtraPractice({ earned: 30, earnedToday: 0 })).toBe(30);
    expect(capExtraPractice({ earned: 30, earnedToday: 25 })).toBe(15);
    expect(capExtraPractice({ earned: 30, earnedToday: 60 })).toBe(0);
  });
});

describe(estimateBrainPower, () => {
  it("estimates a lesson tile from its questions and the finishing bonus", () => {
    expect(
      estimateBrainPower({
        outcome: { ...EMPTY_OUTCOME, firstLessonCompletion: true },
        questions: 8,
      }),
    ).toBe(38 + 10);
  });
});

describe(getAnswersEnergyDelta, () => {
  it("keeps today's Energy rules", () => {
    expect(getAnswersEnergyDelta({ correct: 21, incorrect: 5 })).toBe(3.7);
    expect(getAnswersEnergyDelta({ correct: 0, incorrect: 0 })).toBe(0.1);
  });
});
