import { describe, expect, it } from "vitest";
import { estimateScoreRange } from "../../preparation/estimated-score";
import {
  calibrateRange,
  estimateIrtRange,
  getEstimateCalibration,
  weighByPoints,
} from "./score-estimate";

const MIN_CALIBRATION_REPORTS = 5;

describe(getEstimateCalibration, () => {
  it("waits for enough official results", () => {
    const report = { estimateHigh: 700, estimateLow: 640, official: 690 };

    expect(
      getEstimateCalibration(Array.from({ length: MIN_CALIBRATION_REPORTS - 1 }, () => report)),
    ).toBeNull();
  });

  it("shifts by the average error and widens by how much it varied", () => {
    const calibration = getEstimateCalibration([
      { estimateHigh: 700, estimateLow: 640, official: 690 },
      { estimateHigh: 600, estimateLow: 560, official: 600 },
      { estimateHigh: 720, estimateLow: 680, official: 740 },
      { estimateHigh: 650, estimateLow: 610, official: 650 },
      { estimateHigh: 500, estimateLow: 460, official: 500 },
    ]);

    expect(calibration?.offset).toBeCloseTo(24, 5);
    expect(calibration?.spread).toBeGreaterThan(0);

    const calibrated = calibrateRange({
      calibration,
      range: { high: 700, low: 650 },
      round: Math.round,
    });

    expect(calibrated.low).toBeLessThan(650 + 24);
    expect(calibrated.high).toBeGreaterThan(700 + 24);
  });
});

describe(estimateIrtRange, () => {
  it("is null before a mock and narrows as mocks add up", () => {
    expect(estimateIrtRange({ abilities: [], calibration: null })).toBeNull();

    const one = estimateIrtRange({ abilities: [{ se: 0.4, theta: 1.5 }], calibration: null });

    const three = estimateIrtRange({
      abilities: [
        { se: 0.4, theta: 1.5 },
        { se: 0.4, theta: 1.4 },
        { se: 0.4, theta: 1.6 },
      ],
      calibration: null,
    });

    expect(one && three && three.high - three.low < one.high - one.low).toBe(true);
    expect((three?.low ?? 0) % 10).toBe(0);
  });
});

describe(weighByPoints, () => {
  const endedAt = new Date("2026-10-01T12:00:00Z");

  it("estimates from the share of points, so wrong answers on a test worth double weigh double", () => {
    const weighed = weighByPoints([
      { endedAt, points: { asked: 260, earned: 182 }, total: 170 },
      { endedAt, points: { asked: 260, earned: 130 }, total: 170 },
    ]);

    expect(weighed?.map((mock) => mock.correct / mock.total)).toStrictEqual([0.7, 0.5]);

    const range = estimateScoreRange(weighed ?? []);
    expect(range && (range.low + range.high) / 2).toBeCloseTo(60, 0);
  });

  it("keeps a negative net score at nothing rather than below it", () => {
    expect(
      weighByPoints([{ endedAt, points: { asked: 80, earned: -12 }, total: 80 }]),
    ).toStrictEqual([{ correct: 0, endedAt, total: 80 }]);
  });

  it("leaves mocks without points to the right answers", () => {
    expect(
      weighByPoints([
        { endedAt, points: { asked: 80, earned: 40 }, total: 80 },
        { endedAt, points: null, total: 80 },
      ]),
    ).toBeNull();
  });
});
