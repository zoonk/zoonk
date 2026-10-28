import { describe, expect, it } from "vitest";
import { getStepMoves } from "./step-moves";

const STEPS = [{}, {}, { beside: true }, { beside: true }];

describe(getStepMoves, () => {
  it("walks every step on a phone", () => {
    expect(getStepMoves({ current: 1, steps: STEPS, wide: false })).toStrictEqual({
      back: 0,
      next: 2,
      position: 1,
      total: 4,
    });
  });

  it("skips the steps beside it from `lg`, so the essays are the last step there", () => {
    expect(getStepMoves({ current: 1, steps: STEPS, wide: true })).toStrictEqual({
      back: 0,
      next: -1,
      position: 1,
      total: 2,
    });
  });

  it("leads nowhere from the first step back, nor past the last", () => {
    expect(getStepMoves({ current: 0, steps: [{}], wide: true })).toStrictEqual({
      back: -1,
      next: -1,
      position: 0,
      total: 1,
    });
  });

  it("goes back over a step beside it from `lg` to the one before", () => {
    const steps = [{}, { beside: true }, {}];

    expect(getStepMoves({ current: 2, steps, wide: true })).toMatchObject({ back: 0, position: 1 });

    expect(getStepMoves({ current: 2, steps, wide: false })).toMatchObject({
      back: 1,
      position: 2,
    });
  });
});
