import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type AnswerFromMaterialInput,
  type MaterialAnswer,
  answerFromMaterial,
} from "@zoonk/ai/tasks/v2/material/answer";
import { normalizeString } from "@zoonk/utils/string";
import { type AnswerFromMaterialExpected, TEST_CASES } from "./test-cases";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function parseOutput(output: string): MaterialAnswer | null {
  try {
    return JSON.parse(output) as MaterialAnswer;
  } catch {
    return null;
  }
}

function listChecks({
  answer,
  expected,
}: {
  answer: MaterialAnswer;
  expected: AnswerFromMaterialExpected;
}) {
  const text = normalizeString(answer.answer);

  return [
    { label: "found", passed: answer.found === expected.found },
    {
      label: "pages",
      passed: expected.found
        ? answer.refs.some((ref) => expected.refs.includes(ref))
        : answer.refs.length === 0,
    },
    ...expected.mentions.map((options) => ({
      label: `mentions ${options[0]}`,
      passed: options.some((option) => text.includes(normalizeString(option))),
    })),
  ];
}

/**
 * Code scoring: says whether the material covers the question, cites a right page when it does
 * (and none when it doesn't), and keeps the material's own facts in the answer.
 */
const scoreAnswer: TaskScorer<AnswerFromMaterialExpected> = ({ output, testCase }) => {
  const answer = parseOutput(output);

  if (!answer || !testCase.expected) {
    return createFixedScore({ conclusion: "No answer", score: MIN_SCORE });
  }

  const checks = listChecks({ answer, expected: testCase.expected });
  const failed = checks.filter((check) => !check.passed).map((check) => check.label);

  return createFixedScore({
    conclusion: failed.length === 0 ? "None" : `Wrong: ${failed.join(", ")}`,
    score: MIN_SCORE + (SCORE_RANGE * (checks.length - failed.length)) / checks.length,
  });
};

export const answerFromMaterialTask: Task<
  AnswerFromMaterialInput,
  MaterialAnswer,
  AnswerFromMaterialExpected
> = {
  description: "Answer a question from the learner's own material, citing its pages",
  generate: answerFromMaterial,
  id: "answer-from-material",
  name: "Answer From Material",
  score: scoreAnswer,
  testCases: TEST_CASES,
};
