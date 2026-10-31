import { type ExamScale } from "../exams/scoring/exam-scales";
import { Z_90 } from "../exams/scoring/irt";
import { type MockResult, RECENT_MOCKS } from "./preparation-math";

/** Shown labeled "Estimated" wherever it appears; it never promises a result. */
export type EstimatedScore = {
  calibrated: boolean;
  high: number;
  low: number;
  mocks: number;
  scale: "irt" | "percent" | ExamScale;
};

const MIN_HALF_WIDTH = 0.03;

const MIN_ESTIMATE_QUESTIONS = 30;

function toPercent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

function getRecentMocks(mocks: readonly MockResult[]): MockResult[] {
  return mocks
    .filter((mock) => mock.total > 0)
    .toSorted((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
    .slice(0, RECENT_MOCKS);
}

export function countRecentQuestions(mocks: readonly MockResult[]): number {
  return getRecentMocks(mocks).reduce((sum, mock) => sum + mock.total, 0);
}

export type RecentMockEvidence = { questions: number; subjectOnly: boolean };

export function canEstimateScore(evidence: RecentMockEvidence): boolean {
  return evidence.questions >= MIN_ESTIMATE_QUESTIONS && !evidence.subjectOnly;
}

export function estimateScoreRange(mocks: readonly MockResult[]): EstimatedScore | null {
  const recent = getRecentMocks(mocks);
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
