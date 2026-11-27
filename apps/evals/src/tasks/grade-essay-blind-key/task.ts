import { createFixedScore } from "@/lib/score";
import { type Task } from "@/lib/types";
import { type GradeWritingInput } from "../grade-essay/cases/shared";
import { type GradeWritingOutput, gradeEssayTask } from "../grade-essay/task";
import { type BlindKeyExpected, TEST_CASES } from "./test-cases";

function scoreBlindKeyGrade({
  output,
  testCase,
}: {
  output: string;
  testCase: { id: string; expected?: BlindKeyExpected };
}) {
  const { expected } = testCase;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} has no board mark.`);
  }

  const { result } = JSON.parse(output) as GradeWritingOutput;
  const total = result.kind === "points" ? result.total : { high: 0, low: 0 };
  const midpoint = (total.low + total.high) / 2;
  const { board, max } = expected;
  const error = Math.max(0, board.low - midpoint, midpoint - board.high) / max;
  const score = Math.round(10 * Math.min(1, Math.max(0, 2 - error * 10)) * 100) / 100;

  return createFixedScore({
    conclusion: `Estimate ${total.low}–${total.high} against the board's ${board.low}–${board.high} of ${max}: error ${(error * 100).toFixed(1)}% of the question.`,
    score,
  });
}

export const gradeEssayBlindKeyTask: Task<GradeWritingInput, GradeWritingOutput, BlindKeyExpected> =
  {
    description:
      "Grade board-marked FGV OAB and CACD answers, and ablated full-credit FGV answers, against keys the production writer wrote blind to the board's standard",
    generate: gradeEssayTask.generate,
    id: "grade-essay-blind-key",
    name: "Grade essay against blind keys",
    priorities: gradeEssayTask.priorities,
    score: scoreBlindKeyGrade,
    skippedLanguages: {
      en: "its cases are real answers Brazilian exam boards marked, all written in Portuguese",
    },
    testCases: TEST_CASES,
  };
