import { type ExamScale } from "../exams/scoring/exam-scales";
import { Z_90 } from "../exams/scoring/irt";
import { type MockResult, RECENT_MOCKS } from "./preparation-math";

/**
 * An estimated score as a range, from mock exams only: percent correct, the exam's item response
 * theory scale (ENEM's) when its mocks are scored that way, or the exam's own scale for exams that
 * report on one (SAT 400 to 1600, AP 1 to 5, TOEFL bands 1 to 6). `calibrated` says it was
 * adjusted by official results other learners reported. It is labeled "Estimated" wherever it
 * shows and never promises a result.
 */
export type EstimatedScore = {
  calibrated: boolean;
  high: number;
  low: number;
  mocks: number;
  scale: "irt" | "percent" | ExamScale;
};

/** A 90% interval around the share of right answers is never narrower than 3 points each side. */
const MIN_HALF_WIDTH = 0.03;

function toPercent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

/**
 * Estimates the score range from the last three mocks, pooled by question. There is no estimate
 * before a first mock, and the range narrows as more mock questions are answered.
 */
export function estimateScoreRange(mocks: readonly MockResult[]): EstimatedScore | null {
  const recent = mocks
    .filter((mock) => mock.total > 0)
    .toSorted((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
    .slice(0, RECENT_MOCKS);

  const total = recent.reduce((sum, mock) => sum + mock.total, 0);

  if (total === 0) {
    return null;
  }

  const share = recent.reduce((sum, mock) => sum + mock.correct, 0) / total;
  const halfWidth = Math.max(MIN_HALF_WIDTH, Z_90 * Math.sqrt((share * (1 - share)) / total));

  return {
    calibrated: false,
    high: toPercent(share + halfWidth),
    low: toPercent(share - halfWidth),
    mocks: recent.length,
    scale: "percent",
  };
}
