import { detectLanguageExam } from "../language-exam";

/**
 * Exams that report scores on their own scale instead of points or percent:
 *
 * - SAT: each of its two sections is scored from 200 to 800 in steps of 10, and the total, their
 *   sum, from 400 to 1600. https://satsuite.collegeboard.org/scores/what-scores-mean
 * - AP: a 1 to 5 score, converted from a composite of the multiple-choice and free-response
 *   sections with cutoffs College Board sets for each exam every year.
 *   https://apstudents.collegeboard.org/about-ap-scores
 * - TOEFL iBT: since January 2026, each section and the overall score on a 1 to 6 band in
 *   half-band steps, aligned with the CEFR; the overall is the sections' average rounded to the
 *   nearest half band. https://www.ets.org/toefl/test-takers/ibt/scores/understand-scores.html
 *
 * Mocks measure the share of right answers, and these turn it into the exam's scale so an estimate
 * reads the way the official score will. Official conversions use each test form's own tables, so
 * these are approximations: the result is always a labeled range, and once learners report their
 * official scores, calibration corrects it (`estimates/score-estimate.ts`).
 */
export const EXAM_SCALES = ["ap", "sat", "toefl"] as const;

export type ExamScale = (typeof EXAM_SCALES)[number];

type ScaleRule = {
  /** From the percent of right answers (0 to 100) to the exam's scale, before rounding. */
  fromPercent: (percent: number) => number;
  max: number;
  min: number;
  /** Tells the exam from its name, key or the goal's title. */
  matches: (text: string) => boolean;
  step: number;
};

/**
 * Rough composite cutoffs for AP scores 2 to 5, in percent of the composite. College Board
 * doesn't publish the real ones, which differ by subject and year, so AP estimates lean on
 * calibration more than the others.
 */
const AP_CUTOFFS = { five: 70, four: 55, three: 40, two: 25 } as const;

/** "AP Biology", "AP® Calculus AB", "ap-us-history" or "Advanced Placement", never "TJ-AP". */
const AP_PATTERNS = [/(?:^|[\s(])AP®?\s+\p{Lu}/u, /^ap-/u, /\badvanced placement\b/iu];

const SAT_MIN = 400;
const SAT_POINTS_PER_PERCENT = 12;
const TOEFL_MIN = 1;
const TOEFL_PERCENT_PER_BAND = 20;

const SCALE_RULES: Record<ExamScale, ScaleRule> = {
  ap: {
    fromPercent: (percent) =>
      1 + Object.values(AP_CUTOFFS).filter((cutoff) => percent >= cutoff).length,
    matches: (text) => AP_PATTERNS.some((pattern) => pattern.test(text)),
    max: 5,
    min: 1,
    step: 1,
  },
  sat: {
    fromPercent: (percent) => SAT_MIN + SAT_POINTS_PER_PERCENT * percent,
    matches: (text) => /\bsat\b/iu.test(text),
    max: 1600,
    min: SAT_MIN,
    step: 10,
  },
  toefl: {
    fromPercent: (percent) => TOEFL_MIN + percent / TOEFL_PERCENT_PER_BAND,
    // The TOEFL iBT, which language certificates tell from ITP, Essentials, Junior and Primary.
    matches: (text) => detectLanguageExam(text) === "TOEFL",
    max: 6,
    min: TOEFL_MIN,
    step: 0.5,
  },
};

/** The scale an exam reports on, from its blueprint's name or key or the goal's title. */
export function getExamScale({
  blueprint,
  goal,
}: {
  blueprint: { identityKey: string; name: string } | null;
  goal: { title: string } | null;
}): ExamScale | null {
  const texts = [blueprint?.name, blueprint?.identityKey, goal?.title].filter(
    (text): text is string => Boolean(text),
  );

  return (
    EXAM_SCALES.find((scale) => texts.some((text) => SCALE_RULES[scale].matches(text))) ?? null
  );
}

export function isExamScale(value: string | null): value is ExamScale {
  return EXAM_SCALES.some((scale) => scale === value);
}

/** A value on the exam's scale, rounded to its step and kept within its bounds. */
export function roundToExamScale({ scale, value }: { scale: ExamScale; value: number }): number {
  const { max, min, step } = SCALE_RULES[scale];
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

/** A percent-correct range on the exam's own scale. */
export function percentToExamScale({
  range,
  scale,
}: {
  range: { high: number; low: number };
  scale: ExamScale;
}): { high: number; low: number } {
  const { fromPercent } = SCALE_RULES[scale];

  return {
    high: roundToExamScale({ scale, value: fromPercent(range.high) }),
    low: roundToExamScale({ scale, value: fromPercent(range.low) }),
  };
}

/** Whether a reported score fits the exam's scale: 1350 for the SAT, 4 for AP, 4.5 for TOEFL. */
export function isOnExamScale({ scale, score }: { scale: ExamScale; score: number }): boolean {
  const { max, min, step } = SCALE_RULES[scale];
  return score >= min && score <= max && Number.isInteger(score / step);
}
