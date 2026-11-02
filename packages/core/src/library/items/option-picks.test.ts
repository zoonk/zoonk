import { describe, expect, it } from "vitest";
import { gradeOptionPicks } from "./option-picks";

const options = [true, false, true, false, true].map((isCorrect) => ({ isCorrect }));

describe(gradeOptionPicks, () => {
  it("counts the right picks, the wrong ones and the right options missed", () => {
    expect(gradeOptionPicks({ options, picked: [0, 1, 4] })).toStrictEqual({
      correct: 3,
      isCorrect: false,
      missed: 1,
      right: 2,
      wrong: 1,
    });
  });

  it("is right only when the picks are exactly the right options, in any order", () => {
    expect(gradeOptionPicks({ options, picked: [4, 0, 2] }).isCorrect).toBe(true);
    expect(gradeOptionPicks({ options, picked: [0, 2] }).isCorrect).toBe(false);
  });

  it("counts a pick past the list as wrong and a repeated one once", () => {
    expect(gradeOptionPicks({ options, picked: [0, 0, 2, 4, 9] })).toStrictEqual({
      correct: 3,
      isCorrect: false,
      missed: 0,
      right: 3,
      wrong: 1,
    });
  });
});
