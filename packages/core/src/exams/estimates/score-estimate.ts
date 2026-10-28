import {
  type AbilityEstimate,
  SCORE_STEP,
  Z_90,
  poolAbilities,
  toScaleRange,
} from "../scoring/irt";

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
