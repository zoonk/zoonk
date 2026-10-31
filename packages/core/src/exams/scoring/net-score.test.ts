import { describe, expect, it } from "vitest";
import { type NetAnswer, getCalibrationAdvice, getNetCalibration, getNetScore } from "./net-score";

function answers(
  entries: [NetAnswer["outcome"], boolean, number][],
  wrongPenalty = 1,
): NetAnswer[] {
  return entries.flatMap(([outcome, flagged, times]) =>
    Array.from({ length: times }, () => ({ flagged, outcome, points: 1, wrongPenalty })),
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
        answers: answers(
          [
            ["right", false, 12],
            ["wrong", false, 5],
            ["blank", false, 3],
          ],
          0.25,
        ),
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
          { flagged: false, outcome: "right", points: 1, wrongPenalty: 0.5 },
          { credit: 0.5, flagged: false, outcome: "partial", points: 1, wrongPenalty: 0.5 },
          { flagged: false, outcome: "wrong", points: 1, wrongPenalty: 0.5 },
          { flagged: false, outcome: "blank", points: 1, wrongPenalty: 0.5 },
        ],
        penalty: 0.5,
      }),
    ).toStrictEqual({ blank: 1, max: 4, net: 1, partial: 1, penalty: 0.5, right: 1, wrong: 1 });
  });
});

const UNSURE_TWO_OF_SIX: [NetAnswer["outcome"], boolean, number][] = [
  ["right", false, 9],
  ["wrong", false, 1],
  ["right", true, 2],
  ["wrong", true, 4],
  ["blank", true, 2],
];

describe(getNetCalibration, () => {
  it("advises leaving unsure statements blank when they lose points", () => {
    const calibration = getNetCalibration({ answers: answers(UNSURE_TWO_OF_SIX) });

    expect(calibration).toStrictEqual({
      advice: "blankUnsure",
      blankingGain: 2,
      sure: { answered: 10, right: 9 },
      unsure: { answered: 6, right: 2 },
    });
  });

  it("sets the break-even from the penalty: a fifth of answers right pays where a wrong costs a quarter", () => {
    const calibration = getNetCalibration({ answers: answers(UNSURE_TWO_OF_SIX, 0.25) });

    expect(calibration).toMatchObject({ advice: "keepAnswering", blankingGain: -1 });
  });

  it("encourages answering when unsure answers still earn points", () => {
    const calibration = getNetCalibration({
      answers: answers([
        ["right", true, 4],
        ["wrong", true, 1],
      ]),
    });

    expect(calibration.advice).toBe("keepAnswering");
    expect(calibration.blankingGain).toBe(-3);
  });

  it("gives no advice on too few unsure answers", () => {
    expect(getNetCalibration({ answers: answers([["wrong", true, 2]]) }).advice).toBeNull();
  });
});

describe("per-question penalties", () => {
  it("costs each wrong answer its own question's penalty, as numeric answers that cost nothing beside choices that cost a quarter", () => {
    const mixed: NetAnswer[] = [
      { flagged: true, outcome: "right", points: 1, wrongPenalty: 0.25 },
      { flagged: true, outcome: "wrong", points: 1, wrongPenalty: 0.25 },
      { flagged: true, outcome: "wrong", points: 1, wrongPenalty: 0 },
    ];

    expect(getNetScore({ answers: mixed, penalty: 0.25 }).net).toBe(0.75);
    expect(getNetCalibration({ answers: mixed }).blankingGain).toBe(-0.75);
  });
});

describe(getCalibrationAdvice, () => {
  it("uses the accumulated blanking gain", () => {
    expect(getCalibrationAdvice({ blankingGain: 2, unsure: { answered: 5, right: 1 } })).toBe(
      "blankUnsure",
    );
  });
});

describe("calibration by actual earnings", () => {
  it("uses the flagged answers' own deductions for advice", () => {
    const flagged: NetAnswer[] = [
      { flagged: true, outcome: "right", points: 1, wrongPenalty: 0 },
      ...Array.from({ length: 3 }, (): NetAnswer => ({
        flagged: true,
        outcome: "wrong",
        points: 1,
        wrongPenalty: 0,
      })),
    ];

    expect(getNetCalibration({ answers: flagged })).toMatchObject({
      advice: "keepAnswering",
      blankingGain: -1,
    });
  });

  it("weighs flagged earnings and deductions in each item's points", () => {
    const flagged: NetAnswer[] = [
      { flagged: true, outcome: "right", points: 1, wrongPenalty: 0.25 },
      { flagged: true, outcome: "right", points: 1, wrongPenalty: 0.25 },
      { flagged: true, outcome: "wrong", points: 4, wrongPenalty: 0.5 },
      { flagged: true, outcome: "wrong", points: 4, wrongPenalty: 0.5 },
    ];

    expect(getNetCalibration({ answers: flagged })).toMatchObject({
      advice: "blankUnsure",
      blankingGain: 2,
    });
  });

  it("counts partial earnings as earnings when considering blanking", () => {
    const flagged: NetAnswer[] = Array.from({ length: 4 }, () => ({
      credit: 0.5,
      flagged: true,
      outcome: "partial",
      points: 1,
      wrongPenalty: 1,
    }));

    expect(getNetCalibration({ answers: flagged })).toMatchObject({
      advice: "keepAnswering",
      blankingGain: -2,
    });
  });
});
