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

/**
 * The questions the recent mocks need between them before a score is estimated: with fewer, the
 * 90% range spans 30 points or more (a 7 of 8 read as 68% to 100%), which says nothing and looks
 * like a promise.
 */
const MIN_ESTIMATE_QUESTIONS = 30;

function toPercent(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

/** The last three mocks with questions, newest first: what an estimate reads. */
function getRecentMocks(mocks: readonly MockResult[]): MockResult[] {
  return mocks
    .filter((mock) => mock.total > 0)
    .toSorted((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
    .slice(0, RECENT_MOCKS);
}

/** The questions the last three mocks asked between them, as the ledger counts their answers. */
export function countRecentQuestions(mocks: readonly MockResult[]): number {
  return getRecentMocks(mocks).reduce((sum, mock) => sum + mock.total, 0);
}

/**
 * What the goal's last three mocks hold between them: their questions, and whether every one sat a
 * single subject, which says how that subject goes, never the exam.
 */
export type RecentMockEvidence = { questions: number; subjectOnly: boolean };

/**
 * Whether the recent mocks say enough to estimate the exam's score: `MIN_ESTIMATE_QUESTIONS`
 * between them, and not one subject alone. Until then the score waits, and the learner hears what
 * it waits for.
 */
export function canEstimateScore(evidence: RecentMockEvidence): boolean {
  return evidence.questions >= MIN_ESTIMATE_QUESTIONS && !evidence.subjectOnly;
}

/**
 * Estimates the score range from the last three mocks, pooled by question. There is no estimate
 * before a first mock, and the range narrows as more mock questions are answered.
 */
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
