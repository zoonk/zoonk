import { describe, expect, it } from "vitest";
import { type NetAnswer, getNetCalibration, getNetScore, sumCalibration } from "./net-score";

function answers(entries: [NetAnswer["outcome"], boolean, number][]): NetAnswer[] {
  return entries.flatMap(([outcome, flagged, times]) =>
    Array.from({ length: times }, () => ({ flagged, outcome })),
  );
}

describe(getNetScore, () => {
  it("cancels a right answer with each wrong one and ignores blanks", () => {
    expect(
      getNetScore(
        answers([
          ["right", false, 12],
          ["wrong", false, 5],
          ["blank", false, 3],
        ]),
      ),
    ).toStrictEqual({ blank: 3, max: 20, net: 7, right: 12, wrong: 5 });
  });
});

describe(getNetCalibration, () => {
  it("advises leaving unsure statements blank when they lose points", () => {
    const calibration = getNetCalibration(
      answers([
        ["right", false, 9],
        ["wrong", false, 1],
        ["right", true, 2],
        ["wrong", true, 4],
        ["blank", true, 2],
      ]),
    );

    expect(calibration).toStrictEqual({
      advice: "blankUnsure",
      blankingGain: 2,
      sure: { answered: 10, right: 9 },
      unsure: { answered: 6, right: 2 },
    });
  });

  it("encourages answering when unsure answers still earn points", () => {
    const calibration = getNetCalibration(
      answers([
        ["right", true, 4],
        ["wrong", true, 1],
      ]),
    );

    expect(calibration.advice).toBe("keepAnswering");
    expect(calibration.blankingGain).toBe(-3);
  });

  it("gives no advice on too few unsure answers", () => {
    expect(getNetCalibration(answers([["wrong", true, 2]])).advice).toBeNull();
  });
});

describe(sumCalibration, () => {
  it("adds calibration up across mocks", () => {
    expect(
      sumCalibration([
        { sure: { answered: 10, right: 9 }, unsure: { answered: 2, right: 0 } },
        { sure: { answered: 8, right: 7 }, unsure: { answered: 3, right: 1 } },
      ]),
    ).toStrictEqual({
      advice: "blankUnsure",
      sure: { answered: 18, right: 16 },
      unsure: { answered: 5, right: 1 },
    });
  });
});
