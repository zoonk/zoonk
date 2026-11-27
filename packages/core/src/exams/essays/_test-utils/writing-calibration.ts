import { type WritingCalibration } from "../_utils/writing-calibration";

export function calibrationFixture(
  overrides: Partial<WritingCalibration> = {},
): WritingCalibration {
  return {
    grader: { model: "fixture/model", promptVersion: "fixture-revision" },
    points: true,
    residuals: { over: [], under: [] },
    verdicts: { above: true, below: true },
    ...overrides,
  };
}
