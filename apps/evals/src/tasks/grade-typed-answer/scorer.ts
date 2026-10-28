import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type TypedAnswerGrade } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { findFeedbackWritingIssue, findPraiseMismatch } from "./feedback-writing";
import { type GradeTypedAnswerExpected } from "./test-cases";

const FULL_MATCH_SCORE = 10;
const VERDICT_ONLY_SCORE = 8;
const WRONG_VERDICT_SCORE = 6;
const BROKEN_FEEDBACK_SCORE = 6;

function toLabel(isCorrect: boolean): string {
  return isCorrect ? "correct" : "wrong";
}

function correctionsMatch({
  corrections,
  expected,
}: {
  corrections: TypedAnswerGrade["corrections"];
  expected: string[];
}): boolean {
  const named = corrections.map((correction) => correction.right.toLowerCase());

  return (
    named.length === expected.length &&
    expected.every((form) => named.some((right) => right.includes(form.toLowerCase())))
  );
}

function getScore({
  feedbackIssue,
  keyPointsMatch,
  verdictMatches,
}: {
  feedbackIssue: string | null;
  keyPointsMatch: boolean;
  verdictMatches: boolean;
}): number {
  if (!verdictMatches) {
    return WRONG_VERDICT_SCORE;
  }

  if (feedbackIssue) {
    return BROKEN_FEEDBACK_SCORE;
  }

  return keyPointsMatch ? FULL_MATCH_SCORE : VERDICT_ONLY_SCORE;
}

export const scoreTypedAnswerGrade: TaskScorer<GradeTypedAnswerExpected> = ({
  output,
  testCase,
}) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} has no expected verdict.`);
  }

  const grade = JSON.parse(output) as Pick<
    TypedAnswerGrade,
    "corrections" | "feedback" | "isCorrect" | "keyPoints"
  >;

  const predictedKeyPoints = grade.keyPoints?.map((keyPoint) => keyPoint.met) ?? null;
  const verdictMatches = grade.isCorrect === testCase.expected.isCorrect;

  const expectedCorrections = testCase.expected.corrections ?? [];
  const predictedCorrections = grade.corrections.map((correction) => correction.right);

  const keyPointsMatch =
    JSON.stringify(predictedKeyPoints) === JSON.stringify(testCase.expected.keyPoints) &&
    correctionsMatch({ corrections: grade.corrections, expected: expectedCorrections });

  const feedbackIssue =
    findPraiseMismatch({ feedback: grade.feedback, isCorrect: grade.isCorrect }) ??
    findFeedbackWritingIssue({ feedback: grade.feedback, language: testCase.userInput.language });

  const verdict = `Expected ${toLabel(testCase.expected.isCorrect)} with key points ${JSON.stringify(testCase.expected.keyPoints)} and corrections ${JSON.stringify(expectedCorrections)}; got ${toLabel(grade.isCorrect)} with ${JSON.stringify(predictedKeyPoints)} and ${JSON.stringify(predictedCorrections)}.`;
  const conclusion = feedbackIssue ? `${verdict} Feedback: ${feedbackIssue}.` : verdict;

  return {
    ...createFixedScore({
      conclusion,
      score: getScore({ feedbackIssue, keyPointsMatch, verdictMatches }),
    }),
    classification: {
      expected: toLabel(testCase.expected.isCorrect),
      predicted: toLabel(grade.isCorrect),
    },
  };
};
