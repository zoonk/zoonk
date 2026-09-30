import { describe, expect, it } from "vitest";
import { calibrateRange, estimateIrtRange, getEstimateCalibration } from "./score-estimate";

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
