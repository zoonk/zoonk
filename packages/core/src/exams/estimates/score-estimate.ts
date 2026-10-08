import {
  type AbilityEstimate,
  SCORE_STEP,
  Z_90,
  poolAbilities,
  toScaleRange,
} from "../scoring/irt";

/**
 * Calibration from official results: once enough learners of an exam report theirs, estimates for
 * that exam shift by how far off they were on average and widen by how much they varied. Until
 * then, estimates are shown uncalibrated, and always as a labeled range.
 */
const MIN_CALIBRATION_REPORTS = 5;

export type ReportedResult = { estimateHigh: number; estimateLow: number; official: number };

type EstimateCalibration = { offset: number; spread: number };

export function getEstimateCalibration(
  reports: readonly ReportedResult[],
): EstimateCalibration | null {
  if (reports.length < MIN_CALIBRATION_REPORTS) {
    return null;
  }

  const errors = reports.map(
    (report) => report.official - (report.estimateLow + report.estimateHigh) / 2,
  );

  const offset = errors.reduce((sum, error) => sum + error, 0) / errors.length;
  const variance = errors.reduce((sum, error) => sum + (error - offset) ** 2, 0) / errors.length;

  return { offset, spread: Z_90 * Math.sqrt(variance) };
}

type ScoreRange = { high: number; low: number };

/** Shifts a range by the exam's calibration and widens it by how much the errors varied. */
export function calibrateRange({
  calibration,
  range,
  round,
}: {
  calibration: EstimateCalibration | null;
  range: ScoreRange;
  round: (value: number) => number;
}): ScoreRange {
  if (!calibration) {
    return range;
  }

  return {
    high: round(range.high + calibration.offset + calibration.spread / 2),
    low: round(range.low + calibration.offset - calibration.spread / 2),
  };
}

function toTens(value: number): number {
  return Math.round(value / SCORE_STEP) * SCORE_STEP;
}

/**
 * The estimated score on an item response theory scale (ENEM's) from the last mocks' abilities,
 * pooled so more mocks narrow the range. Null before a first mock.
 */
export function estimateIrtRange({
  abilities,
  calibration,
}: {
  abilities: readonly AbilityEstimate[];
  calibration: EstimateCalibration | null;
}): ScoreRange | null {
  const pooled = poolAbilities(abilities);

  if (!pooled) {
    return null;
  }

  const { high, low } = toScaleRange(pooled);
  return calibrateRange({ calibration, range: { high, low }, round: toTens });
}
