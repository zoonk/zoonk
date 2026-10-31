import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { detectLanguageExam } from "../language-exam";

export const EXAM_SCALES = ["ap", "sat", "toefl"] as const;

export type ExamScale = (typeof EXAM_SCALES)[number];

type ScaleRule = {
  fromPercent: (percent: number) => number;
  max: number;
  min: number;
  matches: (text: string) => boolean;
  step: number;
};

/** Approximate cutoffs; official AP conversions vary by subject and year. */
const AP_CUTOFFS = { five: 70, four: 55, three: 40, two: 25 } as const;

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
    matches: (text) => detectLanguageExam(text) === "TOEFL",
    max: 6,
    min: TOEFL_MIN,
    step: 0.5,
  },
};

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

const ENEM_PATTERN = /\benem\b/iu;

export function isEnemExam({
  blueprint,
  goal,
}: {
  blueprint: { identityKey: string; name: string } | null;
  goal: { title: string } | null;
}): boolean {
  return [blueprint?.name, blueprint?.identityKey, goal?.title].some(
    (text) => text !== undefined && ENEM_PATTERN.test(text),
  );
}

export function isExamScale(value: string | null): value is ExamScale {
  return EXAM_SCALES.some((scale) => scale === value);
}

export function roundToExamScale({ scale, value }: { scale: ExamScale; value: number }): number {
  const { max, min, step } = SCALE_RULES[scale];
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

/** Official conversions use test-specific tables; these estimates are approximations. See https://apstudents.collegeboard.org/about-ap-scores and https://satsuite.collegeboard.org/scores/what-scores-mean. */
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

export type ScoreScale = {
  fromPercent: ((percent: number) => number) | null;
  max: number;
  min: number;
  name: string | null;
  passScore: number | null;
  step: number | null;
};

export function getScoreScale({
  blueprint,
  goal,
  structure,
}: {
  blueprint: { identityKey: string; name: string } | null;
  goal: { title: string } | null;
  structure: ExamStructure | null;
}): ScoreScale | null {
  const notice = structure?.mock?.scoring.scale;

  if (notice) {
    const map = notice.fromPercent;

    return {
      fromPercent: map ? (percent) => map.base + map.perPercent * percent : null,
      max: notice.max,
      min: notice.min,
      name: notice.name,
      passScore: notice.passScore,
      step: notice.step,
    };
  }

  const preset = getExamScale({ blueprint, goal });

  if (!preset) {
    return null;
  }

  const { fromPercent, max, min, step } = SCALE_RULES[preset];
  return { fromPercent, max, min, name: null, passScore: null, step };
}

export function toScaleScore({
  scale,
  share,
}: {
  scale: ScoreScale;
  share: number;
}): number | null {
  if (!scale.fromPercent) {
    return null;
  }

  const PERCENT = 100;
  const value = scale.fromPercent(share * PERCENT);
  const stepped = scale.step ? Math.round(value / scale.step) * scale.step : Math.round(value);

  return Math.min(scale.max, Math.max(scale.min, stepped));
}

export function isOnExamScale({ scale, score }: { scale: ExamScale; score: number }): boolean {
  const { max, min, step } = SCALE_RULES[scale];
  return score >= min && score <= max && Number.isInteger(score / step);
}
