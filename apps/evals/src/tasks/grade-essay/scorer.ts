import { createFixedScore } from "@/lib/score";
import { type TaskScorer, type TestCase } from "@/lib/types";
import {
  type EnemInterventionElements,
  type EssayGrade,
} from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { type GradeEssayExpected } from "./test-cases";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

/** Most criteria should point at a passage; a missing quote here and there is fine. */
const MIN_QUOTED_SHARE = 0.6;

/**
 * Function words that only one of the two languages uses, enough to tell
 * Portuguese feedback from English feedback without a model.
 */
const LANGUAGE_WORDS = {
  en: new Set([
    "the",
    "and",
    "you",
    "your",
    "to",
    "of",
    "is",
    "that",
    "with",
    "for",
    "this",
    "it",
    "are",
    "but",
    "not",
    "by",
    "be",
    "how",
    "what",
    "or",
  ]),
  pt: new Set([
    "de",
    "que",
    "não",
    "para",
    "uma",
    "com",
    "você",
    "seu",
    "sua",
    "os",
    "da",
    "dos",
    "das",
    "em",
    "mais",
    "mas",
    "ao",
    "na",
    "é",
    "por",
    "como",
    "ou",
    "isso",
    "sem",
  ]),
};

type Check = { name: string; passed: boolean; detail: string };

/** Quoted essay text inside feedback is in the essay's language, so it doesn't count. */
function detectLanguage(text: string): "en" | "pt" | null {
  const tokens = text
    .replaceAll(/["“][^"”]*["”]/gu, " ")
    .toLowerCase()
    .split(/[^\p{L}]+/u);

  const en = tokens.filter((token) => LANGUAGE_WORDS.en.has(token)).length;
  const pt = tokens.filter((token) => LANGUAGE_WORDS.pt.has(token)).length;

  if (en === pt) {
    return null;
  }

  return en > pt ? "en" : "pt";
}

function getBandLabel({ band, total }: { band: GradeEssayExpected["totalBand"]; total: number }) {
  if (total < band.min) {
    return "below band";
  }

  return total > band.max ? "above band" : "in band";
}

function checkElements({
  expected,
  grade,
}: {
  expected: GradeEssayExpected;
  grade: EssayGrade;
}): Check[] {
  return Object.entries(expected.interventionElements ?? {}).map(([element, present]) => {
    const found = grade.enemInterventionElements?.[element as keyof EnemInterventionElements];

    return {
      detail: `C5 ${element}: expected ${String(present)}, got ${String(found)}.`,
      name: `c5-${element}`,
      passed: found === present,
    };
  });
}

/** A too-short text never reaches a model, so there is no feedback to check. */
function checkFeedback({
  essay,
  expected,
  grade,
}: {
  essay: string;
  expected: GradeEssayExpected;
  grade: EssayGrade;
}): Check[] {
  if (grade.zeroReason === "tooShort") {
    return [];
  }

  const feedback = [...grade.criteria.map((criterion) => criterion.comment), grade.nextStep.text];
  const language = detectLanguage(feedback.join(" "));

  const quoted = grade.criteria.filter(
    (criterion) => criterion.quote && essay.includes(criterion.quote),
  );

  return [
    {
      detail: `Feedback language: expected ${expected.feedbackLanguage}, detected ${language ?? "unknown"}.`,
      name: "language",
      passed: language === expected.feedbackLanguage,
    },
    {
      detail: "Every criterion has a comment and the next step has text.",
      name: "text",
      passed: feedback.every((text) => text.trim().length > 0),
    },
    {
      detail: `${quoted.length} of ${grade.criteria.length} criteria quote the essay.`,
      name: "quotes",
      passed: quoted.length >= grade.criteria.length * MIN_QUOTED_SHARE,
    },
  ];
}

function getChecks({
  expected,
  grade,
  testCase,
}: {
  expected: GradeEssayExpected;
  grade: EssayGrade;
  testCase: TestCase<GradeEssayExpected>;
}): Check[] {
  const essay = typeof testCase.userInput.essay === "string" ? testCase.userInput.essay : "";
  const band = expected.totalBand;

  return [
    {
      detail: `Total ${grade.total.score} (range ${grade.range.low}–${grade.range.high}), expected ${band.min}–${band.max}.`,
      name: "band",
      passed: getBandLabel({ band, total: grade.total.score }) === "in band",
    },
    {
      detail: `Zero reason: expected ${String(expected.zeroReason)}, got ${String(grade.zeroReason)}.`,
      name: "zeroReason",
      passed: grade.zeroReason === expected.zeroReason,
    },
    {
      detail: `Next step on ${grade.nextStep.criterionId}, expected one of ${expected.nextStepCriteria.join(", ")}.`,
      name: "nextStep",
      passed: expected.nextStepCriteria.includes(grade.nextStep.criterionId),
    },
    ...checkElements({ expected, grade }),
    ...checkFeedback({ essay, expected, grade }),
  ];
}

/**
 * Code-only scoring, so every candidate model is compared on the same checks
 * and the eval stays cheap: the total inside the band a trained examiner
 * would give, the right annulment, the next step on a weak criterion, the ENEM
 * proposal elements, feedback in the learner's language and quotes that
 * exist in the essay. The band check is reported as the classification.
 */
export const scoreEssayGrade: TaskScorer<GradeEssayExpected> = ({ output, testCase }) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} has no expected grade.`);
  }

  const grade = JSON.parse(output) as EssayGrade;
  const checks = getChecks({ expected: testCase.expected, grade, testCase });
  const failed = checks.filter((check) => !check.passed);
  const score = MIN_SCORE + (SCORE_RANGE * (checks.length - failed.length)) / checks.length;

  return {
    ...createFixedScore({
      conclusion:
        failed.length === 0
          ? `All ${checks.length} checks passed. ${checks[0]?.detail ?? ""}`
          : failed.map((check) => check.detail).join(" "),
      score: Math.round(score * 100) / 100,
    }),
    classification: {
      expected: "in band",
      predicted: getBandLabel({ band: testCase.expected.totalBand, total: grade.total.score }),
    },
  };
};
