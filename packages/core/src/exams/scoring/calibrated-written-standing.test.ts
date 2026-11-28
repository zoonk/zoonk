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

const RESIDUALS = {
  over: weightedResiduals([0, 0, 0, 0, 0, 0.01, 0.01, 0.02, 0.04, 0.1]),
  under: weightedResiduals([0, 0, 0, 0, 0, 0.01, 0.02, 0.03, 0.08, 0.12]),
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

describe(calibratedWrittenStanding, () => {
  it.each([
    { answer: grade(56, 56), standing: "met" },
    { answer: grade(55, 55), standing: "overlaps" },
    { answer: grade(39, 41), standing: "below" },
    { answer: grade(40, 42), standing: "overlaps" },
  ])(
    "uses the widest margin for each side of a mixed answer and reports $standing",
    ({ answer, standing }) => {
      const mixed = {
        ...answer,
        calibration: [
          ...answer.calibration,
          rowCalibrationFixture({
            residuals: {
              over: weightedResiduals([0, 0, 0, 0, 0, 0, 0.01, 0.03, 0.06, 0.1]),
              under: weightedResiduals([0, 0, 0, 0, 0, 0, 0, 0.01, 0.02, 0.09]),
            },
          }),
        ],
      };

      expect(calibratedWrittenStanding({ grades: [mixed], part: PART })).toBe(standing);
    },
  );

  it.each([
    { first: grade(30, 30, 50), second: grade(21, 23, 50), standing: "overlaps" },
    { first: grade(30, 30, 50), second: grade(24, 24, 50), standing: "met" },
    { first: grade(28, 29, 50), second: grade(15, 16, 50), standing: "overlaps" },
    { first: grade(28, 29, 60), second: grade(11, 12, 40), standing: "below" },
  ])("sums the bounds of two answers and reports $standing", ({ first, second, standing }) => {
    expect(calibratedWrittenStanding({ grades: [first, second], part: PART })).toBe(standing);
  });

  it.each([
    { answer: grade(54, 55), standing: "met" },
    { answer: grade(53, 54), standing: "overlaps" },
    { answer: grade(40, 41), standing: "below" },
    { answer: grade(41, 42), standing: "overlaps" },
  ])("uses the 80th percentile for each side and reports $standing", ({ answer, standing }) => {
    expect(calibratedWrittenStanding({ grades: [answer], part: PART })).toBe(standing);
  });

  it("makes no call when an answer is missing", () => {
    expect(calibratedWrittenStanding({ grades: [grade(56, 56), null], part: PART })).toBe(
      "unmeasured",
    );
  });

  it.each(["blank", "tooFewLines", "copiedSupport", "identification"] as const)(
    "keeps a %s zero, which code verified, at zero even without measured residuals",
    (zeroKind) => {
      const zero = {
        ...grade(0, 0),
        calibration: [rowCalibrationFixture({ residuals: UNMEASURED })],
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
