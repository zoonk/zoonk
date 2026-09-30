import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  SPEAKING_MOCK_CRITERIA,
  SPEAKING_MOCK_SCALES,
  type SpeakingMockExam,
} from "@zoonk/ai/tasks/v2/language/speaking-mock-bands";
import { type ScoreSpeakingMockSchema } from "@zoonk/ai/tasks/v2/language/speaking-mock-score";
import { SPEAKING_MOCK_SCORE_CATEGORIES } from "./score-categories";
import { type SpeakingMockInput } from "./test-cases";

/** The band window a labeled transcript sits in, like 5 to 5.5 for an IELTS B1 candidate. */
export type SpeakingMockExpected = { bandLow: number; bandHigh: number };

type CriterionScore = { bandHigh: number; bandLow: number; criterion: string };

/** Raters disagree by about half a band, so a range within half a band of the window counts. */
const WINDOW_TOLERANCE = 0.5;
const MAX_RANGE_WIDTH = 1;

function isValidRange({ exam, score }: { exam: SpeakingMockExam; score: CriterionScore }) {
  const { max, min, step } = SPEAKING_MOCK_SCALES[exam];
  const { bandHigh, bandLow } = score;

  return (
    Number.isInteger(bandLow / step) &&
    Number.isInteger(bandHigh / step) &&
    bandLow >= min &&
    bandLow <= bandHigh &&
    bandHigh <= Math.min(max, bandLow + MAX_RANGE_WIDTH)
  );
}

function overlapsWindow({
  expected,
  score,
}: {
  expected: SpeakingMockExpected;
  score: CriterionScore;
}): boolean {
  return (
    score.bandLow <= expected.bandHigh + WINDOW_TOLERANCE &&
    score.bandHigh >= expected.bandLow - WINDOW_TOLERANCE
  );
}

function getCriterionProblem({
  criterion,
  exam,
  expected,
  scores,
}: {
  criterion: string;
  exam: SpeakingMockExam;
  expected: SpeakingMockExpected;
  scores: readonly CriterionScore[];
}): string | null {
  const matches = scores.filter((score) => score.criterion === criterion);
  const [score] = matches;

  if (!score || matches.length > 1) {
    return `${criterion} appears ${matches.length} times instead of once.`;
  }

  if (!isValidRange({ exam, score })) {
    return `${criterion} has an invalid range ${score.bandLow} to ${score.bandHigh}.`;
  }

  if (!overlapsWindow({ expected, score })) {
    return `${criterion} is ${score.bandLow} to ${score.bandHigh}, outside ${expected.bandLow} to ${expected.bandHigh} (plus or minus ${WINDOW_TOLERANCE}).`;
  }

  return null;
}

/**
 * Each of the exam's criteria is one part: present once, a valid range on the exam's scale, and
 * near the labeled window. The overall range is one more part, since learners see it first.
 */
function checkSpeakingMock({
  exam,
  expected,
  output,
}: {
  exam: SpeakingMockExam;
  expected: SpeakingMockExpected;
  output: string;
}): CodeCheckResult {
  const score = JSON.parse(output) as ScoreSpeakingMockSchema;
  const criteria: readonly string[] = SPEAKING_MOCK_CRITERIA[exam];
  const scores: readonly CriterionScore[] = score.criteria;

  const problems = [
    score.exam === exam ? null : `Scored as ${score.exam} instead of ${exam}.`,
    ...criteria.map((criterion) => getCriterionProblem({ criterion, exam, expected, scores })),
    getCriterionProblem({
      criterion: "overall",
      exam,
      expected,
      scores: [{ ...score.overall, criterion: "overall" }],
    }),
  ].filter((problem) => problem !== null);

  const total = criteria.length + 2;

  return { judgedOutput: output, passed: total - problems.length, problems, total };
}

/**
 * Code checks the band ranges against transcripts labeled at a known level;
 * the judge scores the evidence and tips.
 */
export const scoreSpeakingMockOutput: TaskScorer<SpeakingMockExpected> = ({ output, testCase }) => {
  const { expected } = testCase;
  const { exam } = testCase.userInput as SpeakingMockInput;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs an expected band window.`);
  }

  return scoreWithCodeChecks({
    check: (value) => checkSpeakingMock({ exam, expected, output: value }),
    output,
    scoreCategories: SPEAKING_MOCK_SCORE_CATEGORIES,
    testCase,
  });
};
