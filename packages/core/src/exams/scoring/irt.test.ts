import { describe, expect, it } from "vitest";
import {
  type IrtItem,
  estimateAbility,
  getIrtCoherence,
  poolAbilities,
  toIrtItem,
  toScaleRange,
} from "./irt";

const MEDIUM: IrtItem = { difficulty: 0, discrimination: 1, guessing: 0.2 };
const EASY: IrtItem = { difficulty: -1, discrimination: 1, guessing: 0.2 };
const HARD: IrtItem = { difficulty: 1, discrimination: 1, guessing: 0.2 };

describe(estimateAbility, () => {
  it("is the prior without answers", () => {
    const prior = estimateAbility([]);

    expect(prior.theta).toBeCloseTo(0, 5);
    expect(prior.se).toBeCloseTo(1, 2);
  });

  it("stays finite when every answer is right, and rises with more of them", () => {
    const five = estimateAbility(Array.from({ length: 5 }, () => ({ correct: true, item: HARD })));
    const ten = estimateAbility(Array.from({ length: 10 }, () => ({ correct: true, item: HARD })));

    expect(Number.isFinite(five.theta)).toBe(true);
    expect(ten.theta).toBeGreaterThan(five.theta);
    expect(ten.se).toBeLessThan(1);
  });

  it("scores a coherent pattern above the same count of right answers on hard questions only", () => {
    const coherent = estimateAbility([
      { correct: true, item: EASY },
      { correct: true, item: EASY },
      { correct: true, item: MEDIUM },
      { correct: false, item: HARD },
      { correct: false, item: HARD },
    ]);

    const incoherent = estimateAbility([
      { correct: false, item: EASY },
      { correct: false, item: EASY },
      { correct: true, item: MEDIUM },
      { correct: true, item: HARD },
      { correct: true, item: HARD },
    ]);

    expect(coherent.theta).toBeGreaterThan(incoherent.theta);
  });
});

describe(toScaleRange, () => {
  it("maps ability 0 to 500 and clamps to the scale", () => {
    expect(toScaleRange({ se: 0, theta: 0 }).score).toBe(500);
    expect(toScaleRange({ se: 0, theta: 1.71 }).score).toBe(671);
    expect(toScaleRange({ se: 0, theta: -9 })).toStrictEqual({ high: 0, low: 0, score: 0 });
    expect(toScaleRange({ se: 0, theta: 9 }).score).toBe(1000);
  });

  it("gives a 90% range in tens around the score", () => {
    expect(toScaleRange({ se: 0.3, theta: 1.5 })).toStrictEqual({
      high: 700,
      low: 600,
      score: 650,
    });
  });
});

describe(poolAbilities, () => {
  it("narrows the range as mocks add up, weighing precise mocks more", () => {
    const pooled = poolAbilities([
      { se: 0.4, theta: 1 },
      { se: 0.2, theta: 2 },
    ]);

    expect(pooled?.se).toBeLessThan(0.2);
    expect(pooled?.theta).toBeCloseTo(1.8, 5);
    expect(poolAbilities([])).toBeNull();
  });
});

describe(toIrtItem, () => {
  it("uses calibrated values when there are any and the guessing chance of its options", () => {
    expect(toIrtItem({ difficulty: 1, discrimination: 1.4, options: 5 })).toStrictEqual({
      difficulty: 1,
      discrimination: 1.4,
      guessing: 0.2,
    });

    expect(toIrtItem({ difficulty: null, discrimination: null, options: 2 })).toStrictEqual({
      difficulty: 0,
      discrimination: 1,
      guessing: 0.5,
    });
  });
});

describe(getIrtCoherence, () => {
  it("counts easy questions missed next to hard ones answered right", () => {
    expect(
      getIrtCoherence([
        { correct: false, item: EASY },
        { correct: false, item: EASY },
        { correct: false, item: EASY },
        { correct: true, item: HARD },
        { correct: true, item: HARD },
        { correct: true, item: MEDIUM },
      ]),
    ).toStrictEqual({ easyWrong: 3, hardRight: 2, isCoherent: false });

    expect(
      getIrtCoherence([
        { correct: true, item: EASY },
        { correct: false, item: HARD },
      ]),
    ).toStrictEqual({ easyWrong: 0, hardRight: 0, isCoherent: true });
  });
});
