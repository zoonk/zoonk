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
      getNetScore({
        answers: answers([
          ["right", false, 12],
          ["wrong", false, 5],
          ["blank", false, 3],
        ]),
        penalty: 1,
      }),
    ).toStrictEqual({ blank: 3, max: 20, net: 7, partial: 0, penalty: 1, right: 12, wrong: 5 });
  });

  it("takes the notice's share of a right answer for each wrong one, as JEE's -1 against +4", () => {
    expect(
      getNetScore({
        answers: answers([
          ["right", false, 12],
          ["wrong", false, 5],
          ["blank", false, 3],
        ]),
        penalty: 0.25,
      }),
    ).toStrictEqual({
      blank: 3,
      max: 20,
      net: 10.75,
      partial: 0,
      penalty: 0.25,
      right: 12,
      wrong: 5,
    });
  });

  it("adds a partly right answer's share of a point, with no penalty, as JEE Advanced's +2 of +4", () => {
    expect(
      getNetScore({
        answers: [
          { flagged: false, outcome: "right" },
          { credit: 0.5, flagged: false, outcome: "partial" },
          { flagged: false, outcome: "wrong" },
          { flagged: false, outcome: "blank" },
        ],
        penalty: 0.5,
      }),
    ).toStrictEqual({ blank: 1, max: 4, net: 1, partial: 1, penalty: 0.5, right: 1, wrong: 1 });
  });
});

const UNSURE_TWO_OF_SIX = answers([
  ["right", false, 9],
  ["wrong", false, 1],
  ["right", true, 2],
  ["wrong", true, 4],
  ["blank", true, 2],
]);

describe(getNetCalibration, () => {
  it("advises leaving unsure statements blank when they lose points", () => {
    const calibration = getNetCalibration({ answers: UNSURE_TWO_OF_SIX, penalty: 1 });

    expect(calibration).toStrictEqual({
      advice: "blankUnsure",
      blankingGain: 2,
      sure: { answered: 10, right: 9 },
      unsure: { answered: 6, right: 2 },
    });
  });

  it("sets the break-even from the penalty: a fifth of answers right pays where a wrong costs a quarter", () => {
    const calibration = getNetCalibration({ answers: UNSURE_TWO_OF_SIX, penalty: 0.25 });

    expect(calibration).toMatchObject({ advice: "keepAnswering", blankingGain: -1 });
  });

  it("encourages answering when unsure answers still earn points", () => {
    const calibration = getNetCalibration({
      answers: answers([
        ["right", true, 4],
        ["wrong", true, 1],
      ]),
      penalty: 1,
    });

    expect(calibration.advice).toBe("keepAnswering");
    expect(calibration.blankingGain).toBe(-3);
  });

  it("gives no advice on too few unsure answers", () => {
    expect(
      getNetCalibration({ answers: answers([["wrong", true, 2]]), penalty: 1 }).advice,
    ).toBeNull();
  });
});

describe(sumCalibration, () => {
  it("adds calibration up across mocks", () => {
    expect(
      sumCalibration({
        calibrations: [
          { sure: { answered: 10, right: 9 }, unsure: { answered: 2, right: 0 } },
          { sure: { answered: 8, right: 7 }, unsure: { answered: 3, right: 1 } },
        ],
        penalty: 1,
      }),
    ).toStrictEqual({
      advice: "blankUnsure",
      sure: { answered: 18, right: 16 },
      unsure: { answered: 5, right: 1 },
    });
  });
});
