import { describe, expect, it } from "vitest";
import {
  rowCalibrationFixture,
  weightedResiduals,
} from "../essays/_test-utils/writing-calibration";
import {
  type CalibratedWritingGrade,
  calibratedWrittenStanding,
} from "./calibrated-written-standing";

const PART = { max: 100, minimum: { unit: "points", value: 50 } } as const;
const BOTH = { above: true, below: true };

/** Forty residuals rank a one-answer part at the 39th and a two-answer part at the 40th. */
const RESIDUALS = {
  over: weightedResiduals([...Array.from({ length: 38 }, () => 0.01), 0.02, 0.04]),
  under: weightedResiduals([...Array.from({ length: 38 }, () => 0.01), 0.03, 0.03]),
};

const UNMEASURED = { over: [], under: [] };

function grade(low: number, high: number, max = 100): CalibratedWritingGrade {
  return {
    calibration: [rowCalibrationFixture({ residuals: RESIDUALS })],
    kind: "points",
    max,
    total: { high, low },
  };
}

function switched(answer: CalibratedWritingGrade, verdicts: typeof BOTH) {
  return { ...answer, calibration: answer.calibration.map((row) => ({ ...row, verdicts })) };
}

describe(calibratedWrittenStanding, () => {
  it("sums the margins of both row kinds when calling a minimum for a mixed answer", () => {
    const answer = grade(57, 57);
    const mixed = { ...answer, calibration: [...answer.calibration, ...answer.calibration] };

    expect(calibratedWrittenStanding({ grades: [answer], part: PART })).toBe("met");
    expect(calibratedWrittenStanding({ grades: [mixed], part: PART })).toBe("overlaps");
  });

  it.each([
    { first: grade(30, 30, 50), second: grade(23, 23, 50), standing: "overlaps" },
    { first: grade(30, 30, 50), second: grade(24, 24, 50), standing: "met" },
    { first: grade(28, 29, 50), second: grade(15, 17, 50), standing: "below" },
  ])(
    "widens each answer at the two-answer rank and reports $standing",
    ({ first, second, standing }) => {
      expect(calibratedWrittenStanding({ grades: [first, second], part: PART })).toBe(standing);
    },
  );

  it.each([
    { answer: grade(52, 52), standing: "met" },
    { answer: grade(41, 46), standing: "below" },
    { answer: grade(41, 47), standing: "overlaps" },
  ])("uses each side's own margin at the one-answer rank for $standing", ({ answer, standing }) => {
    expect(calibratedWrittenStanding({ grades: [answer], part: PART })).toBe(standing);
  });

  it("makes no call on a side whose verdict the calibration switches off", () => {
    const pass = grade(80, 80);
    const fail = grade(20, 20);
    const onlyBelow = { above: false, below: true };
    const onlyAbove = { above: true, below: false };

    expect(calibratedWrittenStanding({ grades: [switched(pass, onlyBelow)], part: PART })).toBe(
      "unmeasured",
    );

    expect(calibratedWrittenStanding({ grades: [switched(fail, onlyBelow)], part: PART })).toBe(
      "below",
    );

    expect(calibratedWrittenStanding({ grades: [switched(pass, onlyAbove)], part: PART })).toBe(
      "met",
    );

    expect(calibratedWrittenStanding({ grades: [switched(fail, onlyAbove)], part: PART })).toBe(
      "unmeasured",
    );
  });

  it("makes no call on a side that runs out of measured residuals at the part's rank", () => {
    const answer = grade(56, 56);

    const limited = {
      ...answer,
      calibration: [
        rowCalibrationFixture({
          residuals: {
            ...RESIDUALS,
            under: weightedResiduals(Array.from({ length: 9 }, () => 0.01)),
          },
        }),
      ],
    };

    const three = [answer, answer, answer];

    expect(calibratedWrittenStanding({ grades: [limited], part: PART })).toBe("met");

    expect(
      calibratedWrittenStanding({
        grades: [{ ...limited, total: { high: 20, low: 20 } }],
        part: PART,
      }),
    ).toBe("unmeasured");

    expect(calibratedWrittenStanding({ grades: three, part: PART })).toBe("unmeasured");
    expect(calibratedWrittenStanding({ grades: [answer, null], part: PART })).toBe("unmeasured");
  });

  it.each(["blank", "tooFewLines", "copiedSupport", "identification"] as const)(
    "keeps a %s zero, which code verified, at zero even without measured residuals",
    (zeroKind) => {
      const zero = {
        ...grade(0, 0),
        calibration: [
          rowCalibrationFixture({
            residuals: UNMEASURED,
            verdicts: { above: false, below: false },
          }),
        ],
        zeroKind,
      };

      expect(calibratedWrittenStanding({ grades: [zero], part: PART })).toBe("below");
      expect(calibratedWrittenStanding({ grades: [grade(54, 54), zero], part: PART })).toBe("met");
    },
  );

  it.each(["offTopic", "wrongForm"] as const)(
    "widens a %s zero, which a model judged, like any other grade",
    (zeroKind) => {
      const zero = { ...grade(0, 0), zeroKind };

      const unmeasured = {
        ...zero,
        calibration: [rowCalibrationFixture({ residuals: UNMEASURED })],
      };

      const strict = { max: 100, minimum: { unit: "points", value: 60 } } as const;
      const low = { max: 100, minimum: { unit: "points", value: 2 } } as const;

      expect(calibratedWrittenStanding({ grades: [unmeasured], part: strict })).toBe("unmeasured");
      expect(calibratedWrittenStanding({ grades: [zero], part: strict })).toBe("below");
      expect(calibratedWrittenStanding({ grades: [zero], part: low })).toBe("overlaps");
    },
  );
});
