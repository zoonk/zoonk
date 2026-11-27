import { type RowCalibration, type WritingCalibration } from "../_utils/writing-calibration";

export function weightedResiduals(shares: number[]) {
  return shares.map((share) => ({ share, weight: 1 / (shares.length + 1) }));
}

export function rowCalibrationFixture(overrides: Partial<RowCalibration> = {}): RowCalibration {
  return {
    points: true,
    residuals: { over: [], under: [] },
    verdicts: { above: true, below: true },
    ...overrides,
  };
}

export function calibrationFixture(
  overrides: Partial<WritingCalibration> = {},
): WritingCalibration {
  return {
    grader: { model: "fixture/model", promptVersion: "fixture-revision" },
    keysRevision: "0000000000000000000000000000000000000000000000000000000000000000",
    rows: { definitePoint: rowCalibrationFixture() },
    writer: { model: "fixture/writer", promptVersion: "fixture-revision" },
    ...overrides,
  };
}
