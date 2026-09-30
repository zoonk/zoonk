import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type TypedAnswerGrade } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { type GradeTypedAnswerExpected } from "./test-cases";

const FULL_MATCH_SCORE = 10;
const VERDICT_ONLY_SCORE = 8;
const WRONG_VERDICT_SCORE = 6;

function toLabel(isCorrect: boolean): string {
  return isCorrect ? "correct" : "wrong";
}

function getScore({
  keyPointsMatch,
  verdictMatches,
}: {
  keyPointsMatch: boolean;
  verdictMatches: boolean;
}): number {
  if (!verdictMatches) {
    return WRONG_VERDICT_SCORE;
  }

  return keyPointsMatch ? FULL_MATCH_SCORE : VERDICT_ONLY_SCORE;
}

/**
 * Scores the verdict and each key point against a teacher's labels. The
 * verdict decides the label accuracy; a right verdict with a key point marked
 * differently still loses points, since partial credit and feedback use them.
 */
export const scoreTypedAnswerGrade: TaskScorer<GradeTypedAnswerExpected> = ({
  output,
  testCase,
}) => {
  if (!testCase.expected) {
    throw new Error(`Test case ${testCase.id} has no expected verdict.`);
  }

  const grade = JSON.parse(output) as Pick<TypedAnswerGrade, "isCorrect" | "keyPoints">;
  const predictedKeyPoints = grade.keyPoints.map((keyPoint) => keyPoint.met);
  const verdictMatches = grade.isCorrect === testCase.expected.isCorrect;

  const keyPointsMatch =
    JSON.stringify(predictedKeyPoints) === JSON.stringify(testCase.expected.keyPoints);

  const conclusion = `Expected ${toLabel(testCase.expected.isCorrect)} with key points ${JSON.stringify(testCase.expected.keyPoints)}; got ${toLabel(grade.isCorrect)} with ${JSON.stringify(predictedKeyPoints)}.`;

  return {
    ...createFixedScore({ conclusion, score: getScore({ keyPointsMatch, verdictMatches }) }),
    classification: {
      expected: toLabel(testCase.expected.isCorrect),
      predicted: toLabel(grade.isCorrect),
    },
  };
};
