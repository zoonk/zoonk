import { describe, expect, it } from "vitest";
import {
  type CalibratedWritingGrade,
  calibratedWrittenStanding,
} from "./calibrated-written-standing";

const PART = { max: 100, minimum: { unit: "points", value: 50 } } as const;

function grade(low: number, high: number, max = 100): CalibratedWritingGrade {
  return {
    kind: "points",
    max,
    residuals: {
      over: [...Array.from({ length: 18 }, () => 0.01), 0.02, 0.04],
      overFloor: 0,
      under: Array.from({ length: 20 }, () => 0.01),
      underFloor: 0.03,
    },
    total: { high, low },
  };
}

describe(calibratedWrittenStanding, () => {
  it.each([
    { first: grade(30, 30, 50), second: grade(23, 23, 50), standing: "overlaps" },
    { first: grade(30, 30, 50), second: grade(24, 24, 50), standing: "met" },
    { first: grade(28, 29, 50), second: grade(15, 17, 50), standing: "below" },
  ])(
    "widens each item at the two-item rank and reports $standing",
    ({ first, second, standing }) => {
      expect(calibratedWrittenStanding({ grades: [first, second], part: PART })).toBe(standing);
    },
  );

  it.each([
    { answer: grade(52, 52), standing: "met" },
    { answer: grade(41, 46), standing: "below" },
    { answer: grade(41, 47), standing: "overlaps" },
  ])("uses the one-item rank and the conservative floor for $standing", ({ answer, standing }) => {
    expect(calibratedWrittenStanding({ grades: [answer], part: PART })).toBe(standing);
  });

  it("abstains when either direction runs out of measured residuals at the higher rank", () => {
    const answer = grade(56, 56);

    const limited = {
      ...answer,
      residuals: { ...answer.residuals, under: Array.from({ length: 9 }, () => 0.01) },
    };

    expect(calibratedWrittenStanding({ grades: [limited], part: PART })).toBe("met");
    expect(calibratedWrittenStanding({ grades: [limited, answer], part: PART })).toBe("unmeasured");
    expect(calibratedWrittenStanding({ grades: [answer, null], part: PART })).toBe("unmeasured");
  });

  it("keeps a verified zero at zero even without measured residuals", () => {
    const zero = {
      ...grade(0, 0),
      residuals: { over: [], overFloor: 0, under: [], underFloor: 0 },
      zeroKind: "blank" as const,
    };

    expect(calibratedWrittenStanding({ grades: [zero], part: PART })).toBe("below");
    expect(calibratedWrittenStanding({ grades: [grade(54, 54), zero], part: PART })).toBe("met");
  });
});
